require("dotenv").config();
const express = require("express");
const mysql = require("mysql2");

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const bcrypt = require("bcrypt");
const session = require("express-session");

const multer = require("multer");
const mammoth = require("mammoth");
const WordExtractor = require("word-extractor");
const storage = multer.diskStorage({
    destination: "public/uploads/",
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${Date.now()}-${file.fieldname}${ext}`);
    }
});
const upload = multer({ storage });
const resumeStorage = multer.diskStorage({
    destination: "public/uploads/",
    filename: (req, file, cb) => {
        const originalName = path.basename(file.originalname);
        const extension = path.extname(originalName);
        const baseName = path.basename(originalName, extension).replace(/[^a-zA-Z0-9_-]/g, "_");
        cb(null, `${Date.now()}-${baseName || file.fieldname}${extension}`);
    }
});
const resumeUpload = multer({ storage: resumeStorage });
const applicationUpload = multer({
    storage: resumeStorage,
    limits: { fileSize: 10 * 1024 * 1024 }
}).fields([
    { name: "resume", maxCount: 1 },
    { name: "coverLetter", maxCount: 1 }
]);
const handleApplicationUploads = (req, res, next) => {
    applicationUpload(req, res, (error) => {
        if (error) {
            console.error("Application document upload error:", error);
            const message = error.code === "LIMIT_FILE_SIZE"
                ? "Each application document must be 10 MB or smaller."
                : error instanceof multer.MulterError
                    ? "The application documents could not be uploaded."
                    : "Could not process application documents.";
            return res.status(error instanceof multer.MulterError ? 400 : 500).json({ message });
        }
        next();
    });
};
const app = express();
const PORT = 3000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/api/resumes', require('./routes/resumes'));


app.use(session({
    secret: "careerconnect-secret",
    resave: false,
    saveUninitialized: false,
}));
app.use('/api/feedback', require('./routes/feedback'));

// Serve frontend files
app.use(express.static("public"));


 // MySQL connection
const db = mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "recruiting_website"
});

app.set("db", db);

// Render Word resumes as HTML so the profile can display them inside its iframe.
app.get('/api/profile/resume/preview', (req, res) => {
    if (!req.session.userId) return res.status(401).send('Please log in to view your resume.');
    if (req.session.role !== 'job_seeker') return res.status(403).send('Only job seekers can view this resume preview.');

    db.query('SELECT resume_path FROM job_seeker_profiles WHERE user_id = ?', [req.session.userId], async (err, rows) => {
        try {
            if (err) return res.status(500).send('Could not load your resume.');
            const resumePath = rows[0]?.resume_path;
            if (!resumePath) return res.status(404).send('No resume is saved to your profile.');

            const extension = path.extname(resumePath).toLowerCase();
            if (!['.doc', '.docx'].includes(extension)) {
                return res.status(400).send('Only DOC and DOCX files use this preview.');
            }

            const uploadsDir = path.resolve('public/uploads');
            const file = path.resolve('public', resumePath);
            if (!file.startsWith(uploadsDir + path.sep) || !fs.existsSync(file)) {
                return res.status(404).send('Your resume file could not be found.');
            }
            if (fs.statSync(file).size > 10 * 1024 * 1024) {
                return res.status(413).send('Resume files must be 10 MB or smaller to preview.');
            }

            let documentHtml;
            if (extension === '.docx') {
                const converted = await mammoth.convertToHtml({ path: file });
                documentHtml = converted.value;
            } else {
                const document = await new WordExtractor().extract(file);
                const escapeHtml = (text) => text.replace(/[&<>"']/g, (character) => ({
                    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
                })[character]);
                documentHtml = document.getBody().split(/\r?\n\s*\r?\n/)
                    .map((paragraph) => paragraph.trim())
                    .filter(Boolean)
                    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\r?\n/g, '<br>')}</p>`)
                    .join('\n');
            }

            if (!documentHtml.trim()) return res.status(422).send('No readable text was found in this Word resume.');

            res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src data:; frame-ancestors 'self'");
            res.set('X-Content-Type-Options', 'nosniff');
            res.type('html').send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>
*{box-sizing:border-box}body{margin:0;padding:32px;background:#f3f4f6;color:#1f2937;font:14px/1.55 Arial,sans-serif}
.page{max-width:800px;min-height:100%;margin:0 auto;padding:48px;background:#fff;box-shadow:0 1px 8px #0002;overflow-wrap:anywhere}
h1,h2,h3{line-height:1.25}p{margin:0 0 12px}ul,ol{padding-left:24px}table{width:100%;border-collapse:collapse}td,th{padding:6px;border:1px solid #d1d5db}
@media(max-width:600px){body{padding:0}.page{padding:24px}}
</style></head><body><main class="page">${documentHtml}</main></body></html>`);
        } catch (previewError) {
            console.error('Resume preview error:', previewError);
            res.status(422).send('Could not render this Word resume. Try saving it again as DOCX or PDF.');
        }
    });
});

// Connect to MySQL
db.connect((error) => {

    if (error) {
        console.error("MySQL connection failed:", error);
        return;
    }

    console.log("Connected to MySQL database!");
});

// Test route
app.get("/api/test", (req, res) => {

    res.json({
        message: "The server is working!"
    });

});


app.post("/api/register/job-seeker", async (req, res) => {

    const {
        firstName,
        lastName,
        email,
        password
    } = req.body;

    try {

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Save account to users table
        const userSql = `
            INSERT INTO users (email, password, role)
            VALUES (?, ?, ?)
        `;

        db.query(
            userSql,
            [email, hashedPassword, "job_seeker"],
            (error, result) => {

                if (error) {
                    console.error("Registration error:", error);

                    return res.status(500).json({
                        message: "Could not create account."
                    });
                }

                // Get the ID of the newly created user
                const userId = result.insertId;

                // Create the user's profile
                const profileSql = `
                    INSERT INTO job_seeker_profiles
                    (user_id, first_name, last_name)
                    VALUES (?, ?, ?)
                `;

                db.query(
                    profileSql,
                    [userId, firstName, lastName],
                    (profileError) => {

                        if (profileError) {
                            console.error(
                                "Profile creation error:",
                                profileError
                            );

                            return res.status(500).json({
                                message: "Account created, but profile could not be created."
                            });
                        }

                        req.session.userId = userId;
                        req.session.role = "job_seeker";

                        console.log("New Job Seeker account created!");
                        console.log("Email:", email);
                        console.log("User ID:", userId);

                        res.json({
                            message: "Job Seeker account created successfully!"
                        });
                    }
                );
            }
        );

    } catch (error) {

        console.error("Password hashing error:", error);

        res.status(500).json({
            message: "Something went wrong."
        });
    }
});



app.post("/api/register/employer", async (req, res) => {
    const {
        companyName,
        contactName,
        email,
        password
    } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const userSql = `
            INSERT INTO users (email, password, role)
            VALUES (?, ?, ?)
        `;

        db.query(
            userSql,
            [email, hashedPassword, "employer"],
            (error, result) => {
                if (error) {
                    console.error("Employer registration error:", error);

                    if (error.code === "ER_DUP_ENTRY") {
                        return res.status(409).json({
                            message: "That email is already being used."
                        });
                    }

                    return res.status(500).json({
                        message: "Could not create employer account."
                    });
                }

                const userId = result.insertId;

                const profileSql = `
                    INSERT INTO employer_profiles
                    (user_id, company_name, contact_name)
                    VALUES (?, ?, ?)
                `;

                db.query(
                    profileSql,
                    [userId, companyName, contactName],
                    (profileError) => {
                        if (profileError) {
                            console.error(
                                "Employer profile creation error:",
                                profileError
                            );

                            return res.status(500).json({
                                message: "Account created, but employer profile could not be created."
                            });
                        }

                        req.session.userId = userId;
                        req.session.role = "employer";

                        console.log("New Employer account created!");
                        console.log("Email:", email);
                        console.log("User ID:", userId);

                        res.json({
                            message: "Employer account created successfully!"
                        });
                    }
                );
            }
        );
    } catch (error) {
        console.error("Password hashing error:", error);

        res.status(500).json({
            message: "Something went wrong."
        });
    }
});



app.post("/api/login", (req, res) => {

    const { email, password } = req.body;

    const sql = `
        SELECT *
        FROM users
        WHERE email = ?
    `;

    db.query(sql, [email], async (error, results) => {

        if (error) {
            console.error("Login error:", error);

            return res.status(500).json({
                message: "Something went wrong."
            });
        }

        // No account with this email
        if (results.length === 0) {
            return res.status(401).json({
                message: "Invalid email or password."
            });
        }

        const user = results[0];

        // Compare entered password with hashed password
        const passwordMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordMatch) {
            return res.status(401).json({
                message: "Invalid email or password."
            });
        }

        // Save the user's ID and role in the session
        req.session.userId = user.id;
        req.session.role = user.role;

        console.log("User logged in!");
        console.log("User ID:", user.id);
        console.log("Role:", user.role);

        res.json({
            message: "Login successful!",
            role: user.role
        });
    });
});

app.get("/api/profile", (req, res) => {

    // Check if someone is logged in
    if (!req.session.userId) {
        return res.status(401).json({
            message: "Not logged in."
        });
    }

    const userId = req.session.userId;
    const role = req.session.role;

    let sql;

    // Job seeker profile
    if (role === "job_seeker") {

        sql = `
            SELECT
                users.id,
                users.email,
                users.role,
                job_seeker_profiles.first_name,
                job_seeker_profiles.last_name,
                job_seeker_profiles.phone,
                job_seeker_profiles.location,
                job_seeker_profiles.address,
                job_seeker_profiles.postal_code,
                job_seeker_profiles.about,
                job_seeker_profiles.profile_picture,
                job_seeker_profiles.resume_path
            FROM users
            LEFT JOIN job_seeker_profiles
                ON users.id = job_seeker_profiles.user_id
            WHERE users.id = ?
        `;

    // Employer profile
    } else if (role === "employer") {

        sql = `
            SELECT
                users.id,
                users.email,
                users.role,
                employer_profiles.company_name,
                employer_profiles.contact_name,
                employer_profiles.phone,
                employer_profiles.location,
                employer_profiles.about,
                employer_profiles.profile_picture
            FROM users
            LEFT JOIN employer_profiles
                ON users.id = employer_profiles.user_id
            WHERE users.id = ?
        `;

    } else {

        return res.status(400).json({
            message: "Invalid user role."
        });
    }

    db.query(sql, [userId], (error, results) => {

        if (error) {
            console.error("Profile retrieval error:", error);

            return res.status(500).json({
                message: "Could not retrieve profile."
            });
        }

        if (results.length === 0) {
            return res.status(404).json({
                message: "Profile not found."
            });
        }

        res.json(results[0]);
    });
});

app.get("/api/profile/skills", (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({
            message: "Not logged in."
        });
    }

    const userId = req.session.userId;

    const sql = `
        SELECT skill
        FROM job_seeker_skills
        WHERE user_id = ?
        ORDER BY skill
    `;

    db.query(sql, [userId], (error, results) => {
        if (error) {
            console.error("Skills retrieval error:", error);

            return res.status(500).json({
                message: "Could not retrieve skills."
            });
        }

        res.json(results);
    });
});

app.put("/api/profile/skills", (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({
            message: "Not logged in."
        });
    }

    if (req.session.role !== "job_seeker") {
        return res.status(403).json({
            message: "Only job seekers can update skills."
        });
    }

    const userId = req.session.userId;
    const skills = req.body.skills;

    if (!Array.isArray(skills)) {
        return res.status(400).json({
            message: "Invalid skills."
        });
    }

    // Delete the user's existing skills first
    const deleteSql = `
        DELETE FROM job_seeker_skills
        WHERE user_id = ?
    `;

    db.query(deleteSql, [userId], (deleteError) => {
        if (deleteError) {
            console.error("Skills deletion error:", deleteError);

            return res.status(500).json({
                message: "Could not update skills."
            });
        }

        // If the user selected no skills, we're done
        if (skills.length === 0) {
            return res.json({
                message: "Skills updated successfully!"
            });
        }

        const insertSql = `
            INSERT INTO job_seeker_skills (user_id, skill)
            VALUES ?
        `;

        const values = skills.map((skill) => [userId, skill]);

        db.query(insertSql, [values], (insertError) => {
            if (insertError) {
                console.error("Skills insertion error:", insertError);

                return res.status(500).json({
                    message: "Could not save skills."
                });
            }

            res.json({
                message: "Skills updated successfully!"
            });
        });
    });
});




app.put("/api/profile", (req, res) => {

    // Check if someone is logged in
    if (!req.session.userId) {
        return res.status(401).json({
            message: "Not logged in."
        });
    }

    const userId = req.session.userId;
    const role = req.session.role;

    const {
        firstName,
        lastName,
        companyName,
        contactName,
        email,
        phone,
        location,
        about
    } = req.body;

    // Update email in users table
    if (!email) {
        return res.status(400).json({
            message: "Email is required."
        });
    }

    const userSql = `
        UPDATE users
        SET email = ?
        WHERE id = ?
    `;

    db.query(
        userSql,
        [email, userId],
        (error) => {

            if (error) {

                console.error("Email update error:", error);

                // Email already belongs to another account
                if (error.code === "ER_DUP_ENTRY") {
                    return res.status(409).json({
                        message: "That email is already being used."
                    });
                }

                return res.status(500).json({
                    message: "Could not update email."
                });
            }

            // JOB SEEKER
            if (role === "job_seeker") {

                if (!firstName || !lastName) {
                    return res.status(400).json({
                        message: "First name and last name are required."
                    });
                }

                const profileSql = `
                    UPDATE job_seeker_profiles
                    SET
                        first_name = ?,
                        last_name = ?,
                        phone = ?,
                        location = ?,
                        about = ?
                    WHERE user_id = ?
                `;

                db.query(
                    profileSql,
                    [
                        firstName,
                        lastName,
                        phone,
                        location,
                        about,
                        userId
                    ],
                    (profileError) => {

                        if (profileError) {

                            console.error(
                                "Job seeker profile update error:",
                                profileError
                            );

                            return res.status(500).json({
                                message: "Email updated, but profile could not be updated."
                            });
                        }

                        res.json({
                            message: "Profile updated successfully!"
                        });
                    }
                );

            // EMPLOYER
            } else if (role === "employer") {

                if (!companyName) {
                    return res.status(400).json({
                        message: "Company name is required."
                    });
                }

                const profileSql = `
                    UPDATE employer_profiles
                    SET
                        company_name = ?,
                        contact_name = ?,
                        phone = ?,
                        location = ?,
                        about = ?
                    WHERE user_id = ?
                `;

                db.query(
                    profileSql,
                    [
                        companyName,
                        contactName,
                        phone,
                        location,
                        about,
                        userId
                    ],
                    (profileError) => {

                        if (profileError) {

                            console.error(
                                "Employer profile update error:",
                                profileError
                            );

                            return res.status(500).json({
                                message: "Email updated, but employer profile could not be updated."
                            });
                        }

                        res.json({
                            message: "Employer profile updated successfully!"
                        });
                    }
                );

            } else {

                return res.status(400).json({
                    message: "Invalid user role."
                });
            }
        }
    );
});
 


 // ==========================================
 // SETTINGS: CHANGE EMAIL
 // ==========================================

app.post("/api/settings/email", (req, res) => {
    const userId = req.session.userId;

    if (!userId) {
        return res.status(401).json({ message: "Not logged in." });
    }

    const { email, currentPassword } = req.body;

    if (
        typeof email !== "string" ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
        typeof currentPassword !== "string" ||
        !currentPassword
    ) {
        return res.status(400).json({
            message: "Enter a valid email and your current password."
        });
    }

    db.query(
        "SELECT password FROM users WHERE id = ?",
        [userId],
        async (error, results) => {
            if (error) {
                return res.status(500).json({
                    message: "Could not verify your account."
                });
            }

            if (results.length === 0) {
                return res.status(404).json({
                    message: "Account not found."
                });
            }

            try {
                const matches = await bcrypt.compare(
                    currentPassword,
                    results[0].password
                );

                if (!matches) {
                    return res.status(401).json({
                        message: "Current password is incorrect."
                    });
                }

                db.query(
                    "UPDATE users SET email = ? WHERE id = ?",
                    [email.trim(), userId],
                    (updateError) => {
                        if (updateError?.code === "ER_DUP_ENTRY") {
                            return res.status(409).json({
                                message: "That email is already in use."
                            });
                        }

                        if (updateError) {
                            return res.status(500).json({
                                message: "Could not update email."
                            });
                        }

                        return res.json({
                            message: "Email updated successfully."
                        });
                    }
                );
            } catch (error) {
                return res.status(500).json({
                    message: "Could not verify your password."
                });
            }
        }
    );
});


// ==========================================
// SETTINGS: CHANGE PASSWORD
// ==========================================

app.post("/api/settings/password", (req, res) => {
    const userId = req.session.userId;

    if (!userId) {
        return res.status(401).json({ message: "Not logged in." });
    }

    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (
        typeof currentPassword !== "string" ||
        typeof newPassword !== "string" ||
        typeof confirmPassword !== "string" ||
        !currentPassword ||
        newPassword.length < 8 ||
        newPassword !== confirmPassword
    ) {
        return res.status(400).json({
            message: "Use a new password of at least 8 characters and make sure both entries match."
        });
    }

    db.query(
        "SELECT password FROM users WHERE id = ?",
        [userId],
        async (error, results) => {
            if (error) {
                return res.status(500).json({
                    message: "Could not verify your account."
                });
            }

            if (results.length === 0) {
                return res.status(404).json({
                    message: "Account not found."
                });
            }

            try {
                const matches = await bcrypt.compare(
                    currentPassword,
                    results[0].password
                );

                if (!matches) {
                    return res.status(401).json({
                        message: "Current password is incorrect."
                    });
                }

                const hashedPassword = await bcrypt.hash(newPassword, 10);

                db.query(
                    "UPDATE users SET password = ? WHERE id = ?",
                    [hashedPassword, userId],
                    (updateError) => {
                        if (updateError) {
                            return res.status(500).json({
                                message: "Could not update password."
                            });
                        }

                        // Require the user to log in again.
                        req.session.destroy((sessionError) => {
                            if (sessionError) {
                                console.error("Session destruction error:", sessionError);
                            }

                            return res.json({
                                message: "Password updated. Please log in again."
                            });
                        });
                    }
                );
            } catch (error) {
                console.error("Password update error:", error);

                return res.status(500).json({
                    message: "Could not update password."
                });
            }
        }
    );
});



// ==========================================
// SETTINGS: DELETE ACCOUNT
// ==========================================

app.delete("/api/settings/account", (req, res) => {
    const userId = req.session.userId;

    if (!userId) {
        return res.status(401).json({ message: "Not logged in." });
    }

    const { currentPassword, confirmation } = req.body;

    if (
        typeof currentPassword !== "string" ||
        !currentPassword ||
        confirmation !== "DELETE"
    ) {
        return res.status(400).json({
            message: 'Enter your current password and type "DELETE" to confirm.'
        });
    }

    db.query(
        "SELECT password FROM users WHERE id = ?",
        [userId],
        async (error, results) => {
            if (error) {
                return res.status(500).json({
                    message: "Could not verify your account."
                });
            }

            if (results.length === 0) {
                return res.status(404).json({
                    message: "Account not found."
                });
            }

            try {
                const matches = await bcrypt.compare(
                    currentPassword,
                    results[0].password
                );

                if (!matches) {
                    return res.status(401).json({
                        message: "Current password is incorrect."
                    });
                }

                // Related records are removed by the database's
                // existing ON DELETE CASCADE foreign keys.
                db.query(
                    "DELETE FROM users WHERE id = ?",
                    [userId],
                    (deleteError, result) => {
                        if (deleteError) {
                            console.error("Account deletion error:", deleteError);

                            return res.status(500).json({
                                message: "Could not delete account."
                            });
                        }

                        if (result.affectedRows === 0) {
                            return res.status(404).json({
                                message: "Account not found."
                            });
                        }

                        req.session.destroy((sessionError) => {
                            if (sessionError) {
                                console.error("Session destruction error:", sessionError);
                            }

                            return res.json({
                                message: "Account deleted successfully."
                            });
                        });
                    }
                );
            } catch (error) {
                console.error("Account verification error:", error);

                return res.status(500).json({
                    message: "Could not verify your password."
                });
            }
        }
    );
});










// ==========================================
// RECRUITER JOB POSTING ENDPOINTS
// ==========================================

// Create a new job posting (Recruiter only!)
app.post("/api/jobs", (req, res) => {
    
    //Authentification check
    if (!req.session.userId) {
        return res.status(401).json({
            message: "You must be logged in to post a job offer."
        });
    }
    if (req.session.role !== "employer") {
        return res.status(403).json({
            message: "Access denied. Only employers can create job postings."
        });
    }
    
    const{
        title,
        company,
        location,
        category,
        job_type,
        description
    } =req.body;

    //Validation check for required fields
     if (!title || !company || !location || !category || !job_type || !description) {
        return res.status(400).json({
            message: "All fields are required."
        });
    }

    const validJobTypes = ["Full-time", "Part-time", "Contract", "Internship"];
    if (!validJobTypes.includes(job_type)) {
        return res.status(400).json({
            message: "Invalid job type. Must be one of: Full-time, Part-time, Contract, Internship."
        });
    }

    //Insert into the jobs table for the database
    const sql=`
        INSERT INTO jobs (employer_id, title, company, location, category, job_type, description)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(
        sql,
        [
            req.session.userId,
            title.trim(),
            company.trim(),
            location.trim(),
            category.trim(),
            job_type,
            description.trim()
        ],

    (error,result)=>{

        if (error){

        console.error("Error creating job posting:", error);
                               
                            return res.status(500).json({
                                message: "Could not create job posting due to database error."
                            });
                        }

    
             else {
                console.log("New job posting created!");
                console.log("Job ID:", result.insertId);
                console.log("Title:", title);

                return res.status(201).json({
                    message: "Job posting created successfully.",
                    jobID: result.insertId
                });
            }
        }
    );
});
 

    

const APPLICATION_STATUSES = [
    "Applied",
    "Under Review",
    "Interview",
    "Offered",
    "Rejected"
];

app.get("/api/jobs", (req, res) => {

    const search = typeof req.query.q === "string"
        ? req.query.q.trim()
        : "";
    const like = `%${search.replace(/[%_]/g, "")}%`;

    const sql = `
        SELECT
            jobs.id,
            jobs.title,
            jobs.location,
            jobs.category,
            jobs.job_type,
            jobs.description,
            jobs.created_at,
            jobs.company AS company_name
        FROM jobs
        WHERE (
                ? = ''
                OR jobs.title LIKE ?
                OR jobs.location LIKE ?
                OR jobs.job_type LIKE ?
                OR jobs.description LIKE ?
                OR jobs.company LIKE ?
                OR jobs.category LIKE ?
            )
        ORDER BY jobs.created_at DESC
    `;

    db.query(
        sql,
        [search, like, like, like, like, like, like],
        (error, results) => {

            if (error) {
                console.error("Job list error:", error);

                return res.status(500).json({
                    message: "Could not load jobs."
                });
            }

            res.json(results);
        }
    );
});

app.get("/api/employer/jobs", (req, res) => {

    if (!req.session.userId) {
        return res.status(401).json({
            message: "Not logged in."
        });
    }

    if (req.session.role !== "employer") {
        return res.status(403).json({
            message: "Only employers can view their job postings."
        });
    }

    const sql = `
        SELECT id, title, location, job_type, description, 'open' AS status, created_at
        FROM jobs
        WHERE employer_id = ?
        ORDER BY created_at DESC
    `;

    db.query(sql, [req.session.userId], (error, results) => {

        if (error) {
            console.error("Employer job list error:", error);

            return res.status(500).json({
                message: "Could not load your job postings."
            });
        }

        res.json(results);
    });
});

app.get("/api/jobs/:id", (req, res) => {

    const jobId = Number(req.params.id);

    if (!Number.isInteger(jobId) || jobId <= 0) {
        return res.status(400).json({
            message: "A valid job is required."
        });
    }

    const sql = `
        SELECT
            jobs.id,
            jobs.title,
            jobs.location,
            jobs.job_type,
            jobs.description,
            'open' AS status,
            jobs.created_at,
            jobs.company AS company_name
        FROM jobs
        WHERE jobs.id = ?
    `;

    db.query(sql, [jobId], (error, results) => {

        if (error) {
            console.error("Job detail error:", error);

            return res.status(500).json({
                message: "Could not load that job."
            });
        }

        if (results.length === 0) {
            return res.status(404).json({
                message: "That job posting could not be found."
            });
        }

        const job = results[0];

        if (req.session.role !== "job_seeker") {
            return res.json({
                ...job,
                alreadyApplied: false,
                applicationStatus: null
            });
        }

        const applicationSql = `
            SELECT id, status
            FROM applications
            WHERE job_id = ? AND job_seeker_id = ?
        `;

        db.query(
            applicationSql,
            [jobId, req.session.userId],
            (applicationError, applications) => {

                if (applicationError) {
                    console.error(
                        "Application lookup error:",
                        applicationError
                    );

                    return res.status(500).json({
                        message: "Could not load that job."
                    });
                }

                const existingApplication = applications[0] || null;

                res.json({
                    ...job,
                    alreadyApplied: Boolean(existingApplication),
                    applicationStatus: existingApplication
                        ? existingApplication.status
                        : null
                });
            }
        );
    });
});

app.post("/api/applications", handleApplicationUploads, (req, res) => {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const uploadedResume = req.files?.resume?.[0];
    const uploadedCoverLetter = req.files?.coverLetter?.[0];
    let unattachedFiles = [uploadedResume?.path, uploadedCoverLetter?.path].filter(Boolean);
    const discardUnattachedFiles = () => {
        unattachedFiles.forEach((filePath) => {
            fs.unlink(filePath, (error) => {
                if (error) console.error("Could not remove unused application document:", error);
            });
        });
        unattachedFiles = [];
    };

    if (!req.session.userId) {
        discardUnattachedFiles();
        return res.status(401).json({
            message: "Not logged in."
        });
    }

    if (req.session.role !== "job_seeker") {
        discardUnattachedFiles();
        return res.status(403).json({
            message: "Only job seekers can apply for jobs."
        });
    }

    const jobId = Number(body.jobId);
    const coverNote = typeof body.coverNote === "string"
        ? body.coverNote.trim()
        : "";
    const applicationFields = {
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        phone: body.phone,
        address: body.address,
        postalCode: body.postalCode,
        linkedinUrl: body.linkedinUrl,
        portfolioUrl: body.portfolioUrl,
        workAuthorization: body.workAuthorization,
        availabilityDate: body.availabilityDate,
        salaryMin: body.salaryMin,
        salaryMax: body.salaryMax,
        relevantExperience: body.relevantExperience
    };
    const fieldLimits = {
        firstName: 100,
        lastName: 100,
        email: 255,
        phone: 20,
        address: 255,
        postalCode: 20,
        linkedinUrl: 500,
        portfolioUrl: 500,
        workAuthorization: 40,
        availabilityDate: 10,
        salaryMin: 16,
        salaryMax: 16,
        relevantExperience: 5000
    };

    for (const [field, value] of Object.entries(applicationFields)) {
        if (typeof value !== "string" || value.trim().length > fieldLimits[field]) {
            discardUnattachedFiles();
            return res.status(400).json({ message: `Please check the ${field} field.` });
        }
        applicationFields[field] = value.trim();
    }

    if (!applicationFields.firstName || !applicationFields.lastName
        || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(applicationFields.email)) {
        discardUnattachedFiles();
        return res.status(400).json({
            message: "First name, last name, and a valid email address are required."
        });
    }
    if (applicationFields.workAuthorization
        && !["authorized_no_sponsorship", "authorized_sponsorship", "not_authorized"]
            .includes(applicationFields.workAuthorization)) {
        discardUnattachedFiles();
        return res.status(400).json({ message: "Choose a valid work authorization option." });
    }

    for (const field of ["linkedinUrl", "portfolioUrl"]) {
        if (applicationFields[field]) {
            let url;
            try {
                url = new URL(applicationFields[field]);
            } catch {
                discardUnattachedFiles();
                return res.status(400).json({ message: `Enter a valid ${field === "linkedinUrl" ? "LinkedIn" : "portfolio"} URL.` });
            }
            if (!["http:", "https:"].includes(url.protocol)) {
                discardUnattachedFiles();
                return res.status(400).json({ message: "Professional links must use HTTP or HTTPS." });
            }
        }
    }

    if (applicationFields.availabilityDate) {
        const parsedDate = new Date(`${applicationFields.availabilityDate}T00:00:00.000Z`);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(applicationFields.availabilityDate)
            || Number.isNaN(parsedDate.getTime())
            || parsedDate.toISOString().slice(0, 10) !== applicationFields.availabilityDate) {
            discardUnattachedFiles();
            return res.status(400).json({ message: "Enter a valid earliest start date." });
        }
    }

    const salaryPattern = /^\d{1,10}(?:\.\d{1,2})?$/;
    const hasSalaryMin = Boolean(applicationFields.salaryMin);
    const hasSalaryMax = Boolean(applicationFields.salaryMax);
    if (hasSalaryMin !== hasSalaryMax
        || (hasSalaryMin && (!salaryPattern.test(applicationFields.salaryMin)
            || !salaryPattern.test(applicationFields.salaryMax)
            || Number(applicationFields.salaryMin) > Number(applicationFields.salaryMax)))) {
        discardUnattachedFiles();
        return res.status(400).json({
            message: "Enter a valid salary range with a minimum no greater than the maximum."
        });
    }

    if (!Number.isInteger(jobId) || jobId <= 0) {
        discardUnattachedFiles();
        return res.status(400).json({
            message: "A valid job is required."
        });
    }

    if (coverNote.length > 2000) {
        discardUnattachedFiles();
        return res.status(400).json({
            message: "The note must be 2000 characters or fewer."
        });
    }

    const resumeChoice = body.resumeChoice || "profile";
    if (!["profile", "upload"].includes(resumeChoice)) {
        discardUnattachedFiles();
        return res.status(400).json({ message: "Choose a valid resume option." });
    }
    if (resumeChoice === "upload") {
        const extension = uploadedResume && path.extname(uploadedResume.originalname).toLowerCase();
        if (!uploadedResume || ![".pdf", ".doc", ".docx"].includes(extension)) {
            discardUnattachedFiles();
            return res.status(400).json({ message: "Please upload a PDF, DOC, or DOCX resume." });
        }
    } else if (uploadedResume) {
        discardUnattachedFiles();
        return res.status(400).json({
            message: "An uploaded file does not match the selected resume option."
        });
    }
    if (uploadedCoverLetter
        && ![".pdf", ".doc", ".docx"].includes(path.extname(uploadedCoverLetter.originalname).toLowerCase())) {
        discardUnattachedFiles();
        return res.status(400).json({ message: "Additional documents must be PDF, DOC, or DOCX files." });
    }

    const jobSql = `
        SELECT id
        FROM jobs
        WHERE id = ?
    `;

    db.query(jobSql, [jobId], (jobError, jobs) => {
        if (jobError) {
            console.error("Job lookup error:", jobError);
            discardUnattachedFiles();
            return res.status(500).json({
                message: "Could not submit application."
            });
        }

        if (jobs.length === 0) {
            discardUnattachedFiles();
            return res.status(404).json({
                message: "That job posting could not be found."
            });
        }

        const createApplication = (resumePath, coverLetterPath) => {
            const insertSql = `
                INSERT INTO applications (
                    job_id, job_seeker_id, cover_note, resume_path, cover_letter_path,
                    first_name, last_name,
                    email, phone, address, postal_code, linkedin_url, portfolio_url,
                    work_authorization, availability_date, salary_min, salary_max,
                    salary_currency, relevant_experience
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CAD', ?)
            `;

            db.query(
                insertSql,
                [
                    jobId,
                    req.session.userId,
                    coverNote || null,
                    resumePath,
                    coverLetterPath,
                    applicationFields.firstName,
                    applicationFields.lastName,
                    applicationFields.email,
                    applicationFields.phone || null,
                    applicationFields.address || null,
                    applicationFields.postalCode || null,
                    applicationFields.linkedinUrl || null,
                    applicationFields.portfolioUrl || null,
                    applicationFields.workAuthorization || null,
                    applicationFields.availabilityDate || null,
                    hasSalaryMin ? Number(applicationFields.salaryMin) : null,
                    hasSalaryMax ? Number(applicationFields.salaryMax) : null,
                    applicationFields.relevantExperience || null
                ],
                (insertError, result) => {
                    if (insertError) {
                        discardUnattachedFiles();
                        if (insertError.code === "ER_DUP_ENTRY") {
                            return res.status(409).json({
                                message: "You have already applied to this job."
                            });
                        }

                        console.error("Application insert error:", insertError);
                        return res.status(500).json({
                            message: "Could not submit application."
                        });
                    }

                    unattachedFiles = [];
                    res.status(201).json({
                        message: "Application submitted successfully.",
                        application: {
                            id: result.insertId,
                            jobId: jobId,
                            status: "Applied",
                            coverNote: coverNote || null,
                            resumePath
                        }
                    });
                }
            );
        };

        const coverLetterPath = uploadedCoverLetter
            ? `uploads/${uploadedCoverLetter.filename}`
            : null;
        if (resumeChoice === "upload") {
            return createApplication(`uploads/${uploadedResume.filename}`, coverLetterPath);
        }

        db.query(
            "SELECT resume_path FROM job_seeker_profiles WHERE user_id = ?",
            [req.session.userId],
            (profileError, profiles) => {
                if (profileError) {
                    console.error("Profile resume lookup error:", profileError);
                    discardUnattachedFiles();
                    return res.status(500).json({
                        message: "Could not load your profile resume."
                    });
                }

                const resumePath = profiles[0]?.resume_path;
                if (!resumePath) {
                    discardUnattachedFiles();
                    return res.status(400).json({
                        message: "Your profile does not have a resume. Upload one or choose a file."
                    });
                }

                const uploadsDirectory = path.resolve("public/uploads");
                const profileResumeFile = path.resolve("public", resumePath);
                if (!profileResumeFile.startsWith(`${uploadsDirectory}${path.sep}`)
                    || !fs.existsSync(profileResumeFile)) {
                    discardUnattachedFiles();
                    return res.status(400).json({
                        message: "Your profile resume could not be found. Upload it again or choose a file."
                    });
                }

                const originalName = path.basename(resumePath).replace(/^\d+-/, "");
                const applicationResumeName = `${crypto.randomUUID()}-${originalName}`;
                const applicationResumeFile = path.join(uploadsDirectory, applicationResumeName);
                fs.copyFile(profileResumeFile, applicationResumeFile, (copyError) => {
                    if (copyError) {
                        console.error("Could not copy profile resume for application:", copyError);
                        discardUnattachedFiles();
                        fs.unlink(applicationResumeFile, (cleanupError) => {
                            if (cleanupError && cleanupError.code !== "ENOENT") {
                                console.error("Could not remove incomplete application resume:", cleanupError);
                            }
                        });
                        return res.status(500).json({
                            message: "Could not attach your profile resume."
                        });
                    }

                    unattachedFiles.push(applicationResumeFile);
                    createApplication(`uploads/${applicationResumeName}`, coverLetterPath);
                });
            }
        );
    });
});

app.get("/api/applications/mine", (req, res) => {

    if (!req.session.userId) {
        return res.status(401).json({
            message: "Not logged in."
        });
    }

    if (req.session.role !== "job_seeker") {
        return res.status(403).json({
            message: "Only job seekers can view their applications."
        });
    }

    const sql = `
        SELECT
            applications.id,
            applications.status,
            applications.cover_note,
            applications.resume_path,
            applications.cover_letter_path,
            applications.applied_at,
            applications.updated_at,
            jobs.title,
            jobs.location,
            jobs.job_type,
            jobs.company AS company_name
        FROM applications
        JOIN jobs
            ON applications.job_id = jobs.id
        WHERE applications.job_seeker_id = ?
        ORDER BY applications.applied_at DESC
    `;

    db.query(sql, [req.session.userId], (error, results) => {

        if (error) {
            console.error("Application list error:", error);

            return res.status(500).json({
                message: "Could not load your applications."
            });
        }

        res.json(results);
    });
});

app.get("/api/employer/applications", (req, res) => {

    if (!req.session.userId) {
        return res.status(401).json({
            message: "Not logged in."
        });
    }

    if (req.session.role !== "employer") {
        return res.status(403).json({
            message: "Only employers can view applicants."
        });
    }

    const sql = `
        SELECT
            applications.id,
            applications.status,
            applications.cover_note,
            applications.resume_path,
            applications.cover_letter_path,
            applications.applied_at,
            jobs.title AS job_title,
            COALESCE(applications.email, users.email) AS email,
            COALESCE(applications.first_name, job_seeker_profiles.first_name) AS first_name,
            COALESCE(applications.last_name, job_seeker_profiles.last_name) AS last_name,
            COALESCE(applications.phone, job_seeker_profiles.phone) AS phone,
            COALESCE(applications.address, job_seeker_profiles.address) AS address,
            COALESCE(applications.postal_code, job_seeker_profiles.postal_code) AS postal_code,
            applications.linkedin_url,
            applications.portfolio_url,
            applications.work_authorization,
            applications.availability_date,
            applications.salary_min,
            applications.salary_max,
            applications.salary_currency,
            applications.relevant_experience
        FROM applications
        JOIN jobs
            ON applications.job_id = jobs.id
        JOIN users
            ON applications.job_seeker_id = users.id
        LEFT JOIN job_seeker_profiles
            ON users.id = job_seeker_profiles.user_id
        WHERE jobs.employer_id = ?
        ORDER BY applications.applied_at DESC
    `;

    db.query(sql, [req.session.userId], (error, results) => {

        if (error) {
            console.error("Employer application list error:", error);

            return res.status(500).json({
                message: "Could not load applicants."
            });
        }

        res.json(results);
    });
});

app.put("/api/employer/applications/:id", (req, res) => {

    if (!req.session.userId) {
        return res.status(401).json({
            message: "Not logged in."
        });
    }

    if (req.session.role !== "employer") {
        return res.status(403).json({
            message: "Only employers can update application status."
        });
    }

    const applicationId = Number(req.params.id);
    const status = req.body.status;

    if (!Number.isInteger(applicationId) || applicationId <= 0) {
        return res.status(400).json({
            message: "A valid application is required."
        });
    }

    if (!APPLICATION_STATUSES.includes(status)) {
        return res.status(400).json({
            message: "Status must be Applied, Under Review, Interview, Offered, or Rejected."
        });
    }

    const ownershipSql = `
        SELECT applications.id
        FROM applications
        JOIN jobs
            ON applications.job_id = jobs.id
        WHERE applications.id = ?
            AND jobs.employer_id = ?
    `;

    db.query(
        ownershipSql,
        [applicationId, req.session.userId],
        (ownershipError, owned) => {

            if (ownershipError) {
                console.error("Application ownership error:", ownershipError);

                return res.status(500).json({
                    message: "Could not update application status."
                });
            }

            if (owned.length === 0) {
                return res.status(404).json({
                    message: "That application could not be found."
                });
            }

            const updateSql = `
                UPDATE applications
                SET status = ?
                WHERE id = ?
            `;

            db.query(
                updateSql,
                [status, applicationId],
                (updateError) => {

                    if (updateError) {
                        console.error("Application status error:", updateError);

                        return res.status(500).json({
                            message: "Could not update application status."
                        });
                    }

                    res.json({
                        message: "Application status updated.",
                        application: {
                            id: applicationId,
                            status: status
                        }
                    });
                }
            );
        }
    );
});

app.post("/api/logout", (req, res) => {

    req.session.destroy((error) => {

        if (error) {
            console.error("Logout error:", error);

            return res.status(500).json({
                message: "Could not log out."
            });
        }

        res.json({
            message: "Logout successful."
        });
    });

});

// Handle profile picture upload (Both Roles)
app.post('/api/profile/avatar', upload.single('avatar'), (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: 'Please log in first.' });
    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });

    const table = req.session.role === 'employer' ? 'employer_profiles' : 'job_seeker_profiles';

    db.query(`SELECT profile_picture FROM ${table} WHERE user_id = ?`, [req.session.userId], (err, rows) => {
        const oldPicture = rows[0]?.profile_picture;
        if (oldPicture && oldPicture !== 'images/default.png') {
            fs.unlink(path.join('public', oldPicture), () => {});
        }

        const filePath = `uploads/${req.file.filename}`;
        db.query(`UPDATE ${table} SET profile_picture = ? WHERE user_id = ?`, [filePath, req.session.userId], (err) => {
            if (err) return res.status(500).json({ message: 'Error updating profile picture.' });
            res.json({ profile_picture: filePath });
        });
    });
});

// Delete profile picture (Both Roles)
app.delete('/api/profile/avatar', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: 'Please log in first.' });

    const table = req.session.role === 'employer' ? 'employer_profiles' : 'job_seeker_profiles';

    db.query(`SELECT profile_picture FROM ${table} WHERE user_id = ?`, [req.session.userId], (err, rows) => {
        const oldPicture = rows[0]?.profile_picture;
        if (oldPicture && oldPicture !== 'images/default.png') {
            fs.unlink(path.join('public', oldPicture), () => {});
        }

        db.query(`UPDATE ${table} SET profile_picture = "images/default.png" WHERE user_id = ?`, [req.session.userId], (err) => {
            if (err) return res.status(500).json({ message: 'Error removing picture.' });
            res.json({ profile_picture: 'images/default.png' });
        });
    });
});

// Upload resume
app.post('/api/profile/resume', resumeUpload.single('resume'), (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: 'Please log in first.' });
    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });

    // Delete old resume file if one exists
    db.query('SELECT resume_path FROM job_seeker_profiles WHERE user_id = ?', [req.session.userId], (err, rows) => {
        const oldResume = rows[0]?.resume_path;
        if (oldResume) {
            fs.unlink(path.join('public', oldResume), () => {});
        }

        // Save new resume path to MySQL
        const filePath = `uploads/${req.file.filename}`;
        db.query(
            'UPDATE job_seeker_profiles SET resume_path = ? WHERE user_id = ?',
            [filePath, req.session.userId],
            (err) => {
                if (err) return res.status(500).json({ message: 'Error saving resume.' });
                res.json({ message: 'Resume uploaded successfully!', resume_path: filePath });
            }
        );
    });
});

// Delete resume
app.delete('/api/profile/resume', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: 'Please log in first.' });

    db.query('SELECT resume_path FROM job_seeker_profiles WHERE user_id = ?', [req.session.userId], (err, rows) => {
        const resumePath = rows[0]?.resume_path;
        if (resumePath) {
            fs.unlink(path.join('public', resumePath), () => {});
        }

        db.query('UPDATE job_seeker_profiles SET resume_path = NULL WHERE user_id = ?', [req.session.userId], (err) => {
            if (err) return res.status(500).json({ message: 'Error removing resume.' });
            res.json({ message: 'Resume removed successfully.' });
        });
    });
});

// Allow employers to view any candidate's profile & resume
app.get('/api/candidates/:id', (req, res) => {
    db.query('SELECT first_name, last_name, about, profile_picture, resume_path FROM job_seeker_profiles WHERE user_id = ?', 
        [req.params.id], (err, rows) => {
            if (err || !rows.length) return res.status(404).json({ message: 'Candidate not found.' });
            res.json(rows[0]);
        }
    );
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
