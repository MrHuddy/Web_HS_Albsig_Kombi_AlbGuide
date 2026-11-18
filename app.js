// ==========================================
// KONFIGURATION & FAVORITEN (COOKIES)
// ==========================================
const COOKIE_NAME = "albguide_favorites";
const COOKIE_DAYS = 30;

function setCookie(name, value, days) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
    try { localStorage.setItem(name, value); } catch (e) {}
}

function getCookie(name) {
    if (document.cookie) {
        const cookies = document.cookie.split(/;\s*/);
        for (const c of cookies) {
            const eq = c.indexOf("=");
            if (eq > -1 && c.substring(0, eq) === name) {
                return decodeURIComponent(c.substring(eq + 1));
            }
        }
    }
    try {
        const lsVal = localStorage.getItem(name);
        if (lsVal) return lsVal;
    } catch (e) {}
    return null;
}

function getFavorites() {
    const val = getCookie(COOKIE_NAME);
    if (!val) return [];
    try {
        const parsed = JSON.parse(val);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
}

function saveFavorites(favsArray) {
    setCookie(COOKIE_NAME, JSON.stringify(favsArray), COOKIE_DAYS);
}

function toggleFavorite(placeId) {
    if (!placeId) return;
    let favs = getFavorites();
    const index = favs.indexOf(placeId);

    if (index > -1) {
        favs.splice(index, 1);
    } else {
        favs.push(placeId);
    }

    saveFavorites(favs);
    updateAllFavoriteButtons();

    const categorySelect = document.getElementById("category-filter");
    if (categorySelect && categorySelect.value === "favorites") {
        filterPlaces();
    }
}

function toggleFavoriteFromDetails() {
    const details = document.getElementById("place-details");
    const currentId = details.getAttribute("data-current-place-id");
    if (currentId) {
        toggleFavorite(currentId);
    }
}

function updateAllFavoriteButtons() {
    const favs = getFavorites();

    document.querySelectorAll("#places-list article").forEach(article => {
        const placeId = article.getAttribute("data-place-id");
        const btn = article.querySelector(".favorite-btn");
        if (btn && placeId) {
            const isFav = favs.includes(placeId);
            btn.classList.toggle("active", isFav);
            btn.setAttribute("aria-label", isFav ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen");
            btn.title = isFav ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen";
        }
    });

    const details = document.getElementById("place-details");
    const currentDetailId = details.getAttribute("data-current-place-id");
    const detailFavBtn = document.getElementById("details-fav-btn");
    if (detailFavBtn && currentDetailId) {
        const isFav = favs.includes(currentDetailId);
        detailFavBtn.classList.toggle("active", isFav);
    }
}

// ==========================================
// DETAILANSICHT
// ==========================================
function openDetailsFor(placeId, title, category, description, imgSrc) {
    const details = document.getElementById("place-details");
    details.setAttribute("data-current-place-id", placeId);

    document.getElementById("details-title").textContent = title;
    document.getElementById("details-category").innerHTML = `<strong>Kategorie:</strong> ${category}`;
    document.getElementById("details-description").textContent = description;
    if (imgSrc) {
        document.getElementById("details-img").src = imgSrc;
    }

    details.classList.remove("hidden");
    updateAllFavoriteButtons();
    details.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function closeDetails() {
    document.getElementById("place-details").classList.add("hidden");
}

// ==========================================
// REST-API: DATEN LADEN & RENDERN (GET)
// ==========================================
async function loadPlacesFromAPI() {
    try {
        const response = await fetch("/api/places");
        if (!response.ok) throw new Error("Fehler beim Abrufen");

        const places = await response.json();
        renderPlaces(places);
    } catch (err) {
        console.error("Ladefehler:", err);
        document.getElementById("places-list").innerHTML = "<li>Fehler beim Laden der Orte aus der Datenbank.</li>";
    }
}

function renderPlaces(places) {
    const list = document.getElementById("places-list");
    list.innerHTML = "";

    if (places.length === 0) {
        list.innerHTML = "<li>Keine Orte vorhanden.</li>";
        return;
    }

    const favs = getFavorites();

    places.forEach(place => {
        const isFav = favs.includes(place.slug);
        const li = document.createElement("li");

        li.innerHTML = `
            <article data-place-id="${escapeHtml(place.slug)}" data-category="${escapeHtml(place.category)}">
                <div class="place-header">
                    <h4>${escapeHtml(place.title)}</h4>
                    <button type="button" class="favorite-btn ${isFav ? 'active' : ''}" 
                            onclick="toggleFavorite('${escapeHtml(place.slug)}')" 
                            aria-label="${isFav ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}" 
                            title="${isFav ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}">
                        ★
                    </button>
                </div>
                <p><strong>Kategorie:</strong> ${formatCategory(place.category)}</p>
                <p>${escapeHtml(place.description)}</p>
                <button type="button" class="show-map-btn" 
                        onclick="openDetailsFor('${escapeHtml(place.slug)}', '${escapeHtml(place.title)}', '${formatCategory(place.category)}', '${escapeHtml(place.description)}', '${escapeHtml(place.image_url)}')">
                    Auf Karte anzeigen
                </button>
            </article>
        `;
        list.appendChild(li);
    });
}

function formatCategory(cat) {
    const map = {
        'natur': 'Natur & Wandern',
        'kultur': 'Kultur & Geschichte',
        'aussicht': 'Aussichtspunkt',
        'gastro': 'Essen & Trinken'
    };
    return map[cat] || cat;
}

function escapeHtml(text) {
    if (!text) return "";
    return String(text).replace(/[&<>"']/g, m => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[m]));
}

// ==========================================
// FILTERUNG
// ==========================================
function filterPlaces() {
    const query = (document.getElementById("search").value || "").toLowerCase().trim();
    const category = document.getElementById("category-filter").value;
    const favs = getFavorites();

    document.querySelectorAll("#places-list li").forEach(li => {
        const article = li.querySelector("article");
        if (!article) return;

        const placeId = article.getAttribute("data-place-id");
        const placeCategory = article.getAttribute("data-category") || "";
        const text = article.textContent.toLowerCase();

        const matchesQuery = query === "" || text.includes(query);
        let matchesCategory = true;

        if (category === "favorites") {
            matchesCategory = favs.includes(placeId);
        } else if (category !== "") {
            matchesCategory = (placeCategory === category);
        }

        li.style.display = (matchesQuery && matchesCategory) ? "" : "none";
    });
}

// ==========================================
// REST-API: FORMULAR ABSENDEN (POST)
// ==========================================
const addPlaceForm = document.getElementById("add-place-form");
if (addPlaceForm) {
    addPlaceForm.addEventListener("submit", async function(event) {
        event.preventDefault();

        const formData = new FormData(addPlaceForm);
        const placeData = {
            title: formData.get("title"),
            category: formData.get("category"),
            description: formData.get("description"),
            latitude: parseFloat(formData.get("latitude")),
            longitude: parseFloat(formData.get("longitude"))
        };

        try {
            const response = await fetch("/api/places", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(placeData)
            });

            const result = await response.json();

            if (response.ok && result.success) {
                alert("Erfolg: Neuer Ort wurde in SQLite gespeichert!");
                addPlaceForm.reset();
                // Liste sofort mit den neuen Daten aus der DB aktualisieren:
                loadPlacesFromAPI();
            } else {
                const errorMsg = result.errors ? result.errors.join("\n") : (result.error || "Konnte nicht gespeichert werden.");
                alert("Fehler:\n" + errorMsg);
            }
        } catch (error) {
            console.error("Netzwerkfehler:", error);
            alert("Server ist nicht erreichbar!");
        }
    });
}

// Beim Laden der Seite Daten holen
document.addEventListener("DOMContentLoaded", () => {
    loadPlacesFromAPI();
});
