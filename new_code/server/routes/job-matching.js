// POST /api/job-matching
// Asks Gemini to write job recommendations from the seeker's skills, experience,
// education, and preferences, using the same generateContent contract as resume feedback.
// The model may only cite open job ids supplied by the server.

const express = require("express");
const { tryReadResumeParts } = require("../ai/resume-reader");
const {
    CANDIDATE_LIMIT,
    CREATE_MATCH_PROFILE_SQL,
    LOAD_PROFILE_SQL,
    LOAD_SKILLS_SQL,
    MATCH_SCHEMA,
    OPEN_JOBS_SQL,
    RECHECK_SQL,
    SAVE_MATCH_PROFILE_SQL,
    buildMatchPrompt,
    emptyToNull,
    normalizeJobs,
    parseModelPayload,
    presentMatch,
    query,
    readPreferences,
    selectDisplayedMatches,
    validateRecommendations
} = require("../job-matching");

const router = express.Router();
const MODEL = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";


function requireSeeker(req, res) {
    if (!req.session || !req.session.userId) {
        res.status(401).json({ error: "Please log in first." });
        return null;
    }
    if (req.session.role !== "job_seeker") {
        res.status(403).json({ error: "Only job seekers can get job recommendations." });
        return null;
    }
    return req.session.userId;
}

function profileFromRow(row, skills) {
    return {
        firstName: row.first_name || "",
        lastName: row.last_name || "",
        location: row.location || "",
        about: row.about || "",
        skills,
        education: row.education || "",
        experience: row.experience || "",
        preferredJobType: row.preferred_job_type || "",
        preferredLocation: row.preferred_location || "",
        preferredCategory: row.preferred_category || "",
        preferencesNote: row.preferences_note || ""
    };
}

async function loadResumeParts(resumePath) {
    return tryReadResumeParts(resumePath, {
        maxBytes: 10 * 1024 * 1024,
        maxTextChars: 8000
    });
}


async function requestRecommendations(prompt, resumeParts) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
    const request = {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": process.env.GEMINI_API_KEY
        },
        body: JSON.stringify({
            systemInstruction: { parts: [{ text: prompt.systemPrompt }] },
            contents: [{
                role: "user",
                parts: [...resumeParts, { text: prompt.userText }]
            }],
            generationConfig: {
                responseMimeType: "application/json",
                responseJsonSchema: MATCH_SCHEMA,
                maxOutputTokens: 4000,
                temperature: 0.2
            }
        })
    };

    let response;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
        response = await fetch(url, request);
        if (response.status !== 503 || attempt === 3) break;
        console.error(`Gemini job matching busy (${MODEL}), retrying`, attempt);
        await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    if (response.status === 429) {
        return { errorStatus: 429, error: "Free-tier rate limit reached. Wait a minute and try again." };
    }
    if (response.status === 503) {
        console.error("Gemini job matching unavailable:", MODEL, response.status, await response.text());
        return { errorStatus: 503, error: "Gemini is temporarily unavailable. Wait a moment and try again." };
    }
    if (!response.ok) {
        console.error("Gemini job matching error:", response.status, await response.text());
        return { errorStatus: 502, error: "AI service error. Check the API key and model name." };
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    const text = (candidate?.content?.parts || []).map((part) => part.text || "").join("").trim();
    if (!text || candidate?.finishReason === "MAX_TOKENS") {
        console.error("Gemini job matching returned no usable text:", candidate?.finishReason || "NO_CONTENT");
        return { errorStatus: 502, error: "The AI response was incomplete. Please try again." };
    }

    try {
        return { payload: parseModelPayload(text) };
    } catch (error) {
        console.error("Gemini job matching JSON parsing failed:", error.message);
        return { errorStatus: 502, error: "The AI response was incomplete. Please try again." };
    }
}

router.get("/profile", async (req, res) => {
    const userId = requireSeeker(req, res);
    if (!userId) return;

    const db = req.app.get("db");
    if (!db) return res.status(500).json({ error: "Database not available." });

    try {
        await query(db, CREATE_MATCH_PROFILE_SQL);
        const rows = await query(db, LOAD_PROFILE_SQL, [userId]);
        if (!rows.length) {
            return res.status(404).json({ error: "Create your profile before requesting job matches." });
        }
        const skillRows = await query(db, LOAD_SKILLS_SQL, [userId]);
        const skills = skillRows.map((row) => row.skill).filter(Boolean);
        const profile = profileFromRow(rows[0], skills);
        return res.json({
            ...profile,
            hasResume: Boolean(rows[0].resume_path)
        });
    } catch (error) {
        console.error("Job matching profile error:", error);
        return res.status(500).json({ error: "Could not load your matching profile." });
    }
});

router.post("/", async (req, res) => {
    const userId = requireSeeker(req, res);
    if (!userId) return;

    const preferences = readPreferences(req.body);
    if (preferences.error) return res.status(400).json({ error: preferences.error });

    const db = req.app.get("db");
    if (!db) return res.status(500).json({ error: "Database not available." });

    try {
        const saved = preferences.value;
        await query(db, CREATE_MATCH_PROFILE_SQL);
        await query(db, SAVE_MATCH_PROFILE_SQL, [
            userId,
            emptyToNull(saved.education),
            emptyToNull(saved.experience),
            emptyToNull(saved.preferredJobType),
            emptyToNull(saved.preferredLocation),
            emptyToNull(saved.preferredCategory),
            emptyToNull(saved.preferencesNote)
        ]);

        const rows = await query(db, LOAD_PROFILE_SQL, [userId]);
        if (!rows.length) {
            return res.status(404).json({ error: "Create your profile before requesting job matches." });
        }
        const skillRows = await query(db, LOAD_SKILLS_SQL, [userId]);
        const skills = skillRows.map((row) => row.skill).filter(Boolean);
        const profile = profileFromRow(rows[0], skills);
        const jobs = normalizeJobs(await query(db, OPEN_JOBS_SQL, [userId, CANDIDATE_LIMIT]));

        if (jobs.length === 0) {
            return res.json({
                summary: "There are no open jobs left to recommend. Archived, expired, and already-applied jobs are excluded.",
                status: "no_open_jobs",
                usedResume: false,
                candidateCount: 0,
                excludedAppliedJobs: true,
                matches: []
            });
        }

        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ error: "GEMINI_API_KEY is not set on the server." });
        }

        let resumeParts = [];
        let usedResume = false;
        try {
            const loaded = await loadResumeParts(rows[0].resume_path);
            resumeParts = loaded.parts;
            usedResume = loaded.usedResume;
        } catch (error) {
            console.error("Job matching resume read failed:", error);
        }

        const prompt = buildMatchPrompt(profile, jobs, { usedResume });
        const generated = await requestRecommendations(prompt, resumeParts);
        if (generated.error) return res.status(generated.errorStatus).json({ error: generated.error });

        const validated = validateRecommendations(generated.payload, jobs);
        if (!validated.ok) return res.status(502).json({ error: validated.error });
        let visible = validated.matches;
        if (visible.length > 0) {
            const stillOpen = await query(db, RECHECK_SQL, [visible.map((match) => match.jobId), userId]);
            const openIds = new Set(stillOpen.map((row) => Number(row.id)));
            visible = visible.filter((match) => openIds.has(match.jobId));
        }
        visible = selectDisplayedMatches(visible);

        let status = "ok";
        if (visible.length === 0) {
            status = validated.matches.length > 0 ? "unavailable" : validated.rejected.length > 0 ? "unverified" : "no_suitable_matches";
        }

        return res.json({
            summary: validated.summary,
            status,
            usedResume,
            candidateCount: jobs.length,
            excludedAppliedJobs: true,
            matches: visible.map(presentMatch)
        });
    } catch (error) {
        console.error("Job matching error:", error);
        return res.status(500).json({ error: "Could not recommend jobs." });
    }
});

module.exports = router;
