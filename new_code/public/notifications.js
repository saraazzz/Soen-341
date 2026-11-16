(function() {
    function formatRelativeTime(dateString) {
        if (!dateString) return "";
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return "";

        const seconds = Math.floor((new Date() - date) / 1000);
        if (seconds < 60) return "just now";
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }

    function getNotificationIcon(type) {
        switch (type) {
            case "interview_invite":
                return '<i class="bi bi-calendar-check-fill notification-icon"></i>';
            case "job_offer":
                return '<i class="bi bi-trophy-fill notification-icon"></i>';
            case "new_application":
                return '<i class="bi bi-person-badge-fill notification-icon"></i>';
            case "status_update":
                return '<i class="bi bi-check-circle-fill notification-icon"></i>';
            case "deadline_reminder":
                return '<i class="bi bi-alarm-fill notification-icon"></i>';
            default:
                return '<i class="bi bi-bell-fill notification-icon"></i>';
        }
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");
    }

    class NotificationManager {
        constructor() {
            this.container = null;
            this.bellBtn = null;
            this.badge = null;
            this.dropdown = null;
            this.listEl = null;
            this.isOpen = false;
            this.notifications = [];
            this.unreadCount = 0;
            this.isInitialized = false;
        }

        async init() {
            if (this.isInitialized) return;
            const header = document.querySelector(".top-header");
            if (!header) return;

            // Ensure stylesheet is loaded
            if (!document.querySelector('link[href*="notifications.css"]')) {
                const link = document.createElement("link");
                link.rel = "stylesheet";
                link.href = "notifications.css";
                document.head.appendChild(link);
            }

            // Create notification bell container in header
            this.container = document.createElement("div");
            this.container.className = "header-notifications";
            this.container.id = "header-notifications";
            this.container.innerHTML = `
                <button id="notification-bell-btn" class="notification-bell-btn" aria-label="Notifications" aria-expanded="false" type="button">
                    <i class="bi bi-bell"></i>
                    <span id="notification-badge" class="notification-badge" hidden>0</span>
                </button>
                <div id="notification-dropdown" class="notification-dropdown" hidden>
                    <div class="notification-dropdown-header">
                        <h3><i class="bi bi-bell-fill"></i> Notifications</h3>
                        <button id="mark-all-read-btn" class="mark-all-read-btn" type="button">Mark all read</button>
                    </div>
                    <div id="notification-list" class="notification-list">
                        <div class="notification-empty">Loading notifications...</div>
                    </div>
                </div>
            `;

            header.appendChild(this.container);

            this.bellBtn = this.container.querySelector("#notification-bell-btn");
            this.badge = this.container.querySelector("#notification-badge");
            this.dropdown = this.container.querySelector("#notification-dropdown");
            this.listEl = this.container.querySelector("#notification-list");

            this.attachEventListeners();
            this.isInitialized = true;

            // Initial fetch
            await this.fetchNotifications();

            // Poll for updates every 30 seconds
            setInterval(() => this.fetchNotifications(), 30000);
        }

        attachEventListeners() {
            this.bellBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                this.toggleDropdown();
            });

            const markAllBtn = this.container.querySelector("#mark-all-read-btn");
            if (markAllBtn) {
                markAllBtn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    this.markAllAsRead();
                });
            }

            // Close dropdown when clicking outside
            document.addEventListener("click", (e) => {
                if (this.isOpen && !this.container.contains(e.target)) {
                    this.closeDropdown();
                }
            });

            // Close on Escape key
            document.addEventListener("keydown", (e) => {
                if (e.key === "Escape" && this.isOpen) {
                    this.closeDropdown();
                }
            });
        }

        toggleDropdown() {
            if (this.isOpen) {
                this.closeDropdown();
            } else {
                this.openDropdown();
            }
        }

        openDropdown() {
            this.isOpen = true;
            this.dropdown.hidden = false;
            this.bellBtn.setAttribute("aria-expanded", "true");
            this.renderList();
        }

        closeDropdown() {
            this.isOpen = false;
            this.dropdown.hidden = true;
            this.bellBtn.setAttribute("aria-expanded", "false");
        }

        async fetchNotifications() {
            try {
                const response = await fetch("/api/notifications");
                if (response.status === 401) {
                    // User is not logged in; hide bell
                    if (this.container) this.container.hidden = true;
                    return;
                }
                if (!response.ok) return;

                if (this.container) this.container.hidden = false;
                const data = await response.json();
                this.notifications = Array.isArray(data.notifications) ? data.notifications : [];
                this.unreadCount = typeof data.unreadCount === "number" ? data.unreadCount : 0;

                this.updateBadge();
                if (this.isOpen) {
                    this.renderList();
                }
            } catch (err) {
                console.error("Could not fetch notifications:", err);
            }
        }

        updateBadge() {
            if (!this.badge) return;
            if (this.unreadCount > 0) {
                this.badge.hidden = false;
                this.badge.textContent = this.unreadCount > 9 ? "9+" : String(this.unreadCount);
            } else {
                this.badge.hidden = true;
            }
        }

        renderList() {
            if (!this.listEl) return;

            if (this.notifications.length === 0) {
                this.listEl.innerHTML = `
                    <div class="notification-empty">
                        <i class="bi bi-bell-slash" style="font-size: 24px; display: block; margin-bottom: 6px;"></i>
                        No notifications yet.
                    </div>
                `;
                return;
            }

            this.listEl.innerHTML = this.notifications.map((item) => {
                const isUnread = !item.is_read;
                const timeAgo = formatRelativeTime(item.created_at);
                const icon = getNotificationIcon(item.type);

                return `
                    <div class="notification-item type-${escapeHtml(item.type)} ${isUnread ? "unread" : ""}" data-id="${item.id}" data-link="${escapeHtml(item.link || "#")}">
                        ${icon}
                        <div class="notification-content">
                            <div class="notification-title">
                                <span>${escapeHtml(item.title)}</span>
                                <span class="notification-time">${escapeHtml(timeAgo)}</span>
                            </div>
                            <p class="notification-message">${escapeHtml(item.message)}</p>
                        </div>
                        ${isUnread ? '<span class="notification-unread-dot" title="Unread"></span>' : ""}
                    </div>
                `;
            }).join("");

            // Add click listeners to items
            this.listEl.querySelectorAll(".notification-item").forEach((itemEl) => {
                itemEl.addEventListener("click", async () => {
                    const id = itemEl.getAttribute("data-id");
                    const link = itemEl.getAttribute("data-link");

                    if (itemEl.classList.contains("unread")) {
                        try {
                            await fetch(`/api/notifications/${id}/read`, { method: "PUT" });
                            itemEl.classList.remove("unread");
                            const dot = itemEl.querySelector(".notification-unread-dot");
                            if (dot) dot.remove();
                            this.unreadCount = Math.max(0, this.unreadCount - 1);
                            this.updateBadge();
                        } catch (err) {
                            console.error("Error marking read:", err);
                        }
                    }

                    if (link && link !== "#") {
                        window.location.href = link;
                    }
                });
            });
        }

        async markAllAsRead() {
            try {
                const response = await fetch("/api/notifications/read-all", { method: "PUT" });
                if (response.ok) {
                    this.notifications.forEach(n => n.is_read = 1);
                    this.unreadCount = 0;
                    this.updateBadge();
                    this.renderList();
                }
            } catch (err) {
                console.error("Error marking all read:", err);
            }
        }

    }

    // Initialize once DOM is ready
    const manager = new NotificationManager();
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => manager.init());
    } else {
        manager.init();
    }
})();
