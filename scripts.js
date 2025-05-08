AOS.init();

// Elements
const navToggle = document.getElementById("navToggle");
const navLinks = document.getElementById("navLinks");
const dropdownToggle = document.getElementById("dropdownToggle");
const dropdownMenu = document.getElementById("dropdownMenu");
const searchInput = document.getElementById("searchInput");
const suggestions = document.getElementById("suggestions");
const featureCards = Array.from(document.querySelectorAll(".feature-card"));
const noResultsMessage = document.getElementById("noResultsMessage");
const micButton = document.getElementById("micButton");
const searchButton = document.getElementById("searchButton");
const tagFilters = document.querySelectorAll(".tag-filter");
const backToTop = document.getElementById("backToTop");
const scrollHint = document.getElementById("scrollHint");
const initialOverlay = document.getElementById("initialOverlay");
const mainContent = document.getElementById("mainContent");

// State
let currentSuggestions = [];
let selectedSuggestionIndex = -1;
let activeTags = new Set();
let isListening = false;
let recognition;

// Toggle mobile nav menu
navToggle.addEventListener("click", () => {
    const expanded = navToggle.getAttribute("aria-expanded") === "true";
    navToggle.setAttribute("aria-expanded", !expanded);
    navLinks.classList.toggle("show");
});

// Dropdown toggle
dropdownToggle.addEventListener("click", () => {
    const expanded = dropdownToggle.getAttribute("aria-expanded") === "true";
    dropdownToggle.setAttribute("aria-expanded", !expanded);
    dropdownMenu.classList.toggle("show");
});

// Close dropdown when clicking outside
document.addEventListener("click", (e) => {
    if (!dropdownToggle.contains(e.target) && !dropdownMenu.contains(e.target)) {
        dropdownToggle.setAttribute("aria-expanded", "false");
        dropdownMenu.classList.remove("show");
    }
});

// Debounce helper
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Highlight matched text helper
function highlightText(text, query) {
    if (!query) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, "gi");
    return text.replace(regex, '<span class="highlight">$1</span>');
}

// Render cards with highlight and filtering
function renderCards(query = "", tags = []) {
    const lowerQuery = query.toLowerCase();
    let visibleCount = 0;

    featureCards.forEach(card => {
        const feature = card.dataset.feature;
        const featureLower = feature.toLowerCase();
        const tagsList = card.dataset.tags ? card.dataset.tags.toLowerCase().split(",").map(t => t.trim()) : [];

        // Check tag filter
        const tagMatch = tags.length === 0 || tags.some(t => tagsList.includes(t.toLowerCase()));

        // Check search query match
        const queryMatch = !query || featureLower.includes(lowerQuery);

        if (tagMatch && queryMatch) {
            card.style.display = "flex";
            visibleCount++;

            // Highlight matched text in title and description
            const titleEl = card.querySelector(".card-title");
            const descEl = card.querySelector(".card-text");
            titleEl.innerHTML = highlightText(feature, query);
            descEl.innerHTML = highlightText(descEl.textContent, query);
        } else {
            card.style.display = "none";
        }
    });

    // Show or hide no results message
    if (visibleCount === 0) {
        noResultsMessage.classList.remove("hidden");
        noResultsMessage.focus();
    } else {
        noResultsMessage.classList.add("hidden");
    }
}

// Generate suggestions based on input and active tags
function generateSuggestions(query = "", tags = []) {
    const lowerQuery = query.toLowerCase();
    let matches = [];

    featureCards.forEach(card => {
        const feature = card.dataset.feature;
        const featureLower = feature.toLowerCase();
        const tagsList = card.dataset.tags ? card.dataset.tags.toLowerCase().split(",").map(t => t.trim()) : [];

        const tagMatch = tags.length === 0 || tags.some(t => tagsList.includes(t.toLowerCase()));
        const queryMatch = !query || featureLower.includes(lowerQuery);

        if (tagMatch && queryMatch) {
            matches.push(feature);
        }
    });

    // Remove duplicates and limit to 7 suggestions
    matches = [...new Set(matches)].slice(0, 7);

    currentSuggestions = matches;
    selectedSuggestionIndex = -1;

    if (matches.length > 0 && query.trim() !== "") {
        suggestions.style.display = "block";
        suggestions.setAttribute("aria-expanded", "true");
        searchInput.setAttribute("aria-expanded", "true");
        suggestions.innerHTML = matches
            .map(
                (s, i) =>
                    `<div role="option" id="suggestion-${i}" tabindex="-1" data-index="${i}">${highlightText(
                        s,
                        query
                    )}</div>`
            )
            .join("");
    } else {
        suggestions.style.display = "none";
        suggestions.setAttribute("aria-expanded", "false");
        searchInput.setAttribute("aria-expanded", "false");
        suggestions.innerHTML = "";
    }
}

// Debounced search handler
const debouncedSearch = debounce(() => {
    showThinking(true);
    setTimeout(() => {
        const query = searchInput.value.trim();
        generateSuggestions(query, Array.from(activeTags));
        renderCards(query, Array.from(activeTags));
        showThinking(false);
    }, 600);
}, 300);

// Show or hide "🤖 Thinking..." loader in suggestions
function showThinking(isThinking) {
    if (isThinking) {
        suggestions.style.display = "block";
        suggestions.setAttribute("aria-expanded", "true");
        searchInput.setAttribute("aria-expanded", "true");
        suggestions.innerHTML = `<div class="text-center text-muted py-2 select-none" aria-live="polite">🤖 Thinking...</div>`;
    }
}

// Search input event
searchInput.addEventListener("input", () => {
    debouncedSearch();
});

// Suggestions click event (event delegation)
suggestions.addEventListener("click", (e) => {
    if (e.target && e.target.dataset.index !== undefined) {
        const index = parseInt(e.target.dataset.index);
        if (currentSuggestions[index]) {
            searchInput.value = currentSuggestions[index];
            suggestions.style.display = "none";
            suggestions.setAttribute("aria-expanded", "false");
            searchInput.setAttribute("aria-expanded", "false");
            renderCards(searchInput.value.trim(), Array.from(activeTags));
            searchInput.focus();
        }
    }
});

// Keyboard navigation for suggestions
searchInput.addEventListener("keydown", (e) => {
    if (suggestions.style.display === "block") {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            selectedSuggestionIndex++;
            if (selectedSuggestionIndex >= currentSuggestions.length) selectedSuggestionIndex = 0;
            updateSuggestionHighlight();
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            selectedSuggestionIndex--;
            if (selectedSuggestionIndex < 0) selectedSuggestionIndex = currentSuggestions.length - 1;
            updateSuggestionHighlight();
        } else if (e.key === "Enter") {
            if (selectedSuggestionIndex >= 0 && selectedSuggestionIndex < currentSuggestions.length) {
                e.preventDefault();
                searchInput.value = currentSuggestions[selectedSuggestionIndex];
                suggestions.style.display = "none";
                suggestions.setAttribute("aria-expanded", "false");
                searchInput.setAttribute("aria-expanded", "false");
                renderCards(searchInput.value.trim(), Array.from(activeTags));
            }
        } else if (e.key === "Escape") {
            suggestions.style.display = "none";
            suggestions.setAttribute("aria-expanded", "false");
            searchInput.setAttribute("aria-expanded", "false");
        }
    }
});

// Update suggestion highlight visually and aria-activedescendant
function updateSuggestionHighlight() {
    const children = suggestions.querySelectorAll("div");
    children.forEach((child, i) => {
        if (i === selectedSuggestionIndex) {
            child.classList.add("highlighted");
            searchInput.setAttribute("aria-activedescendant", child.id);
            child.scrollIntoView({ block: "nearest" });
        } else {
            child.classList.remove("highlighted");
        }
    });
    if (selectedSuggestionIndex === -1) {
        searchInput.removeAttribute("aria-activedescendant");
    }
}

// Search button click triggers search immediately
searchButton.addEventListener("click", () => {
    suggestions.style.display = "none";
    suggestions.setAttribute("aria-expanded", "false");
    searchInput.setAttribute("aria-expanded", "false");
    renderCards(searchInput.value.trim(), Array.from(activeTags));
    searchInput.focus();
});

// Tag filter click and keyboard support
tagFilters.forEach(tagEl => {
    tagEl.addEventListener("click", () => {
        toggleTagFilter(tagEl);
    });
    tagEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleTagFilter(tagEl);
        }
    });
});

function toggleTagFilter(tagEl) {
    const tag = tagEl.dataset.tag;
    if (activeTags.has(tag)) {
        activeTags.delete(tag);
        tagEl.classList.remove("active");
    } else {
        activeTags.add(tag);
        tagEl.classList.add("active");
    }
    // Re-run search with updated tags
    generateSuggestions(searchInput.value.trim(), Array.from(activeTags));
    renderCards(searchInput.value.trim(), Array.from(activeTags));
}

// Back to top button show/hide on scroll
window.addEventListener("scroll", () => {
    if (window.scrollY > 300) {
        backToTop.classList.add("show");
    } else {
        backToTop.classList.remove("show");
    }
    // Scroll hint hide after user scrolls down 100px
    if (window.scrollY > 100) {
        scrollHint.classList.add("hide");
    } else {
        scrollHint.classList.remove("hide");
    }
});

backToTop.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    backToTop.blur();
});

// Voice recognition setup
if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.addEventListener("start", () => {
        isListening = true;
        micButton.classList.add("listening");
        micButton.setAttribute("aria-label", "Listening, click to stop");
    });

    recognition.addEventListener("end", () => {
        isListening = false;
        micButton.classList.remove("listening");
        micButton.setAttribute("aria-label", "Voice Search");
    });

    recognition.addEventListener("result", (event) => {
        const transcript = event.results[0][0].transcript;
        searchInput.value = transcript;
        suggestions.style.display = "none";
        suggestions.setAttribute("aria-expanded", "false");
        searchInput.setAttribute("aria-expanded", "false");
        renderCards(transcript.trim(), Array.from(activeTags));
        searchInput.focus();
    });

    recognition.addEventListener("error", (event) => {
        isListening = false;
        micButton.classList.remove("listening");
        micButton.setAttribute("aria-label", "Voice Search");
        alert("Voice recognition error: " + event.error);
    });

    micButton.addEventListener("click", () => {
        if (isListening) {
            recognition.stop();
        } else {
            recognition.start();
        }
    });
} else {
    // If no speech recognition support, disable mic button
    micButton.style.display = "none";
}

// Accessibility: close suggestions if clicking outside
document.addEventListener("click", (e) => {
    if (!searchInput.contains(e.target) && !suggestions.contains(e.target) && !micButton.contains(e.target)) {
        suggestions.style.display = "none";
        suggestions.setAttribute("aria-expanded", "false");
        searchInput.setAttribute("aria-expanded", "false");
    }
});

// Initial render
renderCards("", []);

// Initial animation logic
window.addEventListener("load", () => {
    // Animate main content fadeInUp
    mainContent.classList.add("animate-fadeInUp");

    // After 2 seconds, fade out and remove overlay
    setTimeout(() => {
        initialOverlay.classList.add("fade-out");
        // Remove overlay from DOM after transition
        initialOverlay.addEventListener("transitionend", () => {
            if (initialOverlay.parentNode) {
                initialOverlay.parentNode.removeChild(initialOverlay);
            }
            // Focus main content for accessibility
            mainContent.focus();
        });
    }, 2000);
});
