/*!
 * Weather Widget by Eranga Dissanayaka (https://www.codesense.nz)
 * Developed with the help of Google Gemini and OpenAI ChatGPT
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 */

// --- API Keys & Units ---
const OPENWEATHER_API_KEY = 'YOUR_API_KEY'; // <<< REPLACE WITH YOUR OPENWEATHERMAP API KEY
const Maps_API_KEY = 'YOUR_API_KEY'; // <<< REPLACE WITH YOUR GOOGLE MAPS API KEY (Needs Places API enabled)

const UNITS = 'metric'; // Use 'metric' for Celsius, 'imperial' for Fahrenheit

// --- Global Map and Location Variables ---
let map;
let mapMarker; // Leaflet marker
let radarLayer; // To hold the OpenWeatherMap radar tile layer
let autocomplete; // Google Places Autocomplete instance

// This will store the current location's lat/lng, updated by geolocation or search
let currentLocation = {
    lat: -37.787,   // Default: Hamilton, NZ
    lng: 175.275
};

// --- DOM Elements ---
const locationSearchInput = document.getElementById('location-search-input');
const searchButton = document.getElementById('search-button');
const radarToggleCheckbox = document.getElementById('radar-toggle-checkbox');
const currentWeatherDetailsDiv = document.getElementById('current-weather-details');
const dailyForecastDiv = document.getElementById('daily-forecast');
const hourlyForecastDiv = document.getElementById('hourly-forecast'); // NEW: Hourly forecast panel
const dateTimeDiv = document.getElementById('date-time');

const currentdate = new Date();

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

let hours = currentdate.getHours();
const minutes = currentdate.getMinutes().toString().padStart(2, '0');
const ampm = hours >= 12 ? 'pm' : 'am';

hours = hours % 12;
hours = hours ? hours : 12; // 0 becomes 12

const datetime = `${monthNames[currentdate.getMonth()]} ${currentdate.getDate()}, ${hours}:${minutes}${ampm}`;

dateTimeDiv.innerHTML = datetime;

// --- Map Initialization (Using Leaflet.js) ---
function initMap() {
    map = L.map('map').setView([currentLocation.lat, currentLocation.lng], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    mapMarker = L.marker([currentLocation.lat, currentLocation.lng]).addTo(map)
        .bindPopup("Loading Location...").openPopup();

    radarLayer = L.tileLayer(`https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${OPENWEATHER_API_KEY}`, {
        opacity: 0.7,
        attribution: 'Weather data &copy; <a href="https://openweathermap.org">OpenWeatherMap</a>'
    });

    locationSearchInput.addEventListener('click', function() {
        this.value = ''; // 'this' refers to the input element itself
    });

    radarToggleCheckbox.addEventListener('change', function() {
        if (this.checked) {
            radarLayer.addTo(map);
        } else {
            map.removeLayer(radarLayer);
        }
    });

    // Start by getting user's geolocation
    getUserGeolocation();
}


// --- Google Places Autocomplete Initialization ---
// This function is called by the Google Maps API script directly (via 'callback=initGooglePlacesSearch')
window.initGooglePlacesSearch = function() {
    if (!Maps_API_KEY || Maps_API_KEY === "YOUR_Maps_API_KEY") {
        console.error("Google Maps API Key is missing or not replaced. Places search will not work.");
        locationSearchInput.placeholder = "Google Search Disabled (API Key Missing)";
        locationSearchInput.disabled = true;
        return;
    }

    autocomplete = new google.maps.places.Autocomplete(locationSearchInput, {
        types: [ 'geocode'], // Restrict to cities and general geocoding
        fields: ['geometry', 'formatted_address', 'name'] // Request necessary fields
    });

    autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (!place.geometry) {
            console.warn("Autocomplete returned no geometry for the selected place:", place);
            bootbox.alert("Location not found. Please try a different search or click the search button for a broader lookup.");
            return;
        }

        // Update location and fetch data for the selected place
        // The formatted_address provides a more complete name for display
        updateLocationAndFetchWeather(place.geometry.location.lat(), place.geometry.location.lng(), place.formatted_address || place.name);
    });
};


// --- Geolocation Function ---
function getUserGeolocation() {
    currentWeatherDetailsDiv.innerHTML = `<p>Attempting to detect your location...</p>`;
    dailyForecastDiv.innerHTML = `<p>Attempting to detect your location...</p>`;

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                //console.log(`Geolocation successful: ${lat}, ${lng}`);
                reverseGeocodeNominatim(lat, lng); // Use Nominatim for reverse geocoding
            },
            (error) => {
                console.warn(`Geolocation error: ${error.message}. Falling back to default location.`);
                alert(`Could not detect your location: ${error.message}. Displaying weather for default location (Hamilton).`);
                updateLocationAndFetchWeather(currentLocation.lat, currentLocation.lng, "Hamilton, New Zealand (Default)");
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    } else {
        console.log("Geolocation is not supported by this browser. Using default location.");
        alert("Your browser does not support Geolocation. Using default location (Hamilton).");
        updateLocationAndFetchWeather(currentLocation.lat, currentLocation.lng, "Hamilton, New Zealand (Default)");
    }
}

// --- Geocoding (Text to Lat/Lng) using Nominatim (for manual search button fallback) ---
async function geocodeAddressNominatim(address) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;

    currentWeatherDetailsDiv.innerHTML = `<p>Searching for "${address}"...</p>`;
    dailyForecastDiv.innerHTML = `<p>Searching for "${address}"...</p>`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Nominatim API HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();

        if (data.length > 0) {
            const lat = parseFloat(data[0].lat);
            const lng = parseFloat(data[0].lon);
            const name = data[0].display_name;
            console.log(`Nominatim Geocoded "${address}" to: ${lat}, ${lng} (${name})`);
            updateLocationAndFetchWeather(lat, lng, name);
        } else {
            const errorMessage = `Location "${address}" not found by Nominatim. Please try a different name or use autocomplete suggestions.`;
            console.error(errorMessage);
            alert(errorMessage);
            currentWeatherDetailsDiv.innerHTML = `<p>${errorMessage}</p>`;
            dailyForecastDiv.innerHTML = `<p>${errorMessage}</p>`;
        }
    } catch (error) {
        console.error("Error geocoding address with Nominatim:", error);
        alert(`Error searching location: ${error.message}.`);
        currentWeatherDetailsDiv.innerHTML = `<p>Error searching location: ${error.message}</p>`;
        dailyForecastDiv.innerHTML = `<p>Error searching location: ${error.message}</p>`;
    }
}

// --- Reverse Geocoding (Lat/Lng to Text) using Nominatim ---
// (Used by geolocation, could also be used if clicking on map for reverse lookup)
async function reverseGeocodeNominatim(lat, lng) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Nominatim API HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        let locationName = "Unknown Location";
        if (data && data.address.country && data.address.city) {
            locationName = data.address.city + ', ' + data.address.country;
        } else {
            console.warn("Nominatim reverse geocode data unexpected:", data);
            locationName = `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
        }
        //console.log(`Nominatim Reverse geocoded ${lat}, ${lng} to: ${locationName}`);
        updateLocationAndFetchWeather(lat, lng, locationName);

    } catch (error) {
        console.error("Error reverse geocoding with Nominatim:", error);
        updateLocationAndFetchWeather(lat, lng, `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`); // Fallback name
    }
}


// --- Central Function to Update UI and Fetch Weather ---
function updateLocationAndFetchWeather(lat, lng, nameForDisplay) {
    currentLocation.lat = lat;
    currentLocation.lng = lng;

    map.setView([lat, lng], 12);
    mapMarker.setLatLng([lat, lng]).bindPopup(nameForDisplay).openPopup();

    currentWeatherDetailsDiv.innerHTML = `<p>Loading current weather for ${nameForDisplay}...</p>`;
    dailyForecastDiv.innerHTML = `<p>Loading forecast for ${nameForDisplay}...</p>`;
    hourlyForecastDiv.innerHTML = `<p>Loading hourly forecast for ${nameForDisplay}...</p>`;

    fetchCurrentWeather(currentLocation.lat, currentLocation.lng);
    fetchDailyForecast(currentLocation.lat, currentLocation.lng);
    fetchHourlyForecast(currentLocation.lat, currentLocation.lng);

    locationSearchInput.value = nameForDisplay;
}

//Fetch Hourly Forecast Function
async function fetchHourlyForecast(lat, lng) {
    // IMPORTANT: The 'pro.openweathermap.org' domain is for professional/paid plans.
    // If you are on a free tier, this endpoint will likely return an error (e.g., 401 Unauthorized).
    // For free, hourly-like data (every 3 hours), you'd typically use the standard /forecast endpoint.
    // For true 1-hour data on a free tier, OpenWeatherMap's One Call API 3.0 is usually needed (with its own limits).
    const url = `https://pro.openweathermap.org/data/2.5/forecast/hourly?lat=${lat}&lon=${lng}&appid=${OPENWEATHER_API_KEY}&units=${UNITS}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`OpenWeatherMap Hourly Forecast Error! Status: ${response.status} - ${errorData.message || 'Unknown error'}. Please check your OpenWeatherMap API subscription for this endpoint.`);
        }
        const data = await response.json();
        displayHourlyForecast(data);
    } catch (error) {
        console.error("Error fetching hourly forecast:", error);
        // hourlyForecastDiv.innerHTML = `<p>Failed to load hourly forecast. Error: ${error.message}.</p>`;
        hourlyForecastDiv.innerHTML = `<p>Not Subscribed.</p>`;
    }
}

// --- OpenWeatherMap API Functions (no changes) ---
async function fetchCurrentWeather(lat, lng) {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${OPENWEATHER_API_KEY}&units=${UNITS}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`OpenWeatherMap Current Error! Status: ${response.status} - ${errorData.message || 'Unknown error'}`);
        }
        const data = await response.json();
        displayCurrentWeather(data);
    } catch (error) {
        console.error("Error fetching current weather:", error);
        currentWeatherDetailsDiv.innerHTML = `<p>Failed to load current weather. Error: ${error.message}.</p>`;
    }
}

async function fetchDailyForecast(lat, lng) {
    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&appid=${OPENWEATHER_API_KEY}&units=${UNITS}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`OpenWeatherMap Forecast Error! Status: ${response.status} - ${errorData.message || 'Unknown error'}`);
        }
        const data = await response.json();
        displayDailyForecast(data);
    } catch (error) {
        console.error("Error fetching daily forecast:", error);
        dailyForecastDiv.innerHTML = `<p>Failed to load forecast. Error: ${error.message}.</p>`;
    }
}


// --- Display Functions (no changes) ---
function displayCurrentWeather(data) {
    if (!data || !data.main || !data.weather || data.weather.length === 0) {
        currentWeatherDetailsDiv.innerHTML = `<p>No current weather data available for this location.</p>`;
        return;
    }
    const temp = data.main.temp;
    const feelsLike = data.main.feels_like;
    const description = data.weather[0].description;
    const iconCode = data.weather[0].icon;
    const humidity = data.main.humidity;
    const windSpeed = data.wind.speed;
    const windDeg = data.wind.deg;
    const cityName = data.name;

    const iconUrl = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
    const tempUnit = UNITS === 'metric' ? '°C' : '°F';
    const windUnit = UNITS === 'metric' ? 'm/s' : 'mph';

    function degToCardinal(deg) {
        const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
        const index = Math.round((deg % 360) / 22.5);
        return directions[index];
    }
    const windDirection = degToCardinal(windDeg);

    currentWeatherDetailsDiv.innerHTML = `
        <p class="current-location-name">${cityName}</p>
        <p>${description.charAt(0).toUpperCase() + description.slice(1)}</p>
        ${data.rain && data.rain['1h'] ? `${data.rain['1h']}mm ` : ''} 
        <p class="current-condition-text">
            <img src="${iconUrl}" alt="${description}" class="current-condition-icon">
            ${temp.toFixed(0)}${tempUnit}
        </p>
        <div class="current-details-row">
            <div class="current-detail-item">
                <strong>${feelsLike.toFixed(0)}${tempUnit}</strong>
                <span>Feels Like</span>
            </div>
            <div class="current-detail-item">
                <strong>${humidity}%</strong>
                <span>Humidity</span>
            </div>
            <div class="current-detail-item">
                <strong><i id="locationIcon" class="fas fa-location-arrow wind-direction-icon"></i>${windSpeed.toFixed(1)}${windUnit} ${windDirection}</strong>
                <span>Wind</span>
            </div>
        </div>
    `;

    const icon = document.getElementById("locationIcon");
    if (icon) {
        icon.style.transform = `rotate(${windDeg+135}deg)`;
    }
}

//Display Hourly Forecast Function
function displayHourlyForecast(data) {
    if (!data || !data.list || data.list.length === 0) {
        hourlyForecastDiv.innerHTML = `<p>No hourly forecast data available.</p>`;
        return;
    }

    hourlyForecastDiv.innerHTML = ''; // Clear previous content

    const now = Date.now();
    // Filter out any past hourly entries and limit to the next 48 hours (or less if data not available)
    const displayedHours = data.list.filter(item => item.dt * 1000 >= now);
    const hoursToShow = 48; // Typically, this endpoint provides 48 hours of 1-hour data

    for (let i = 0; i < Math.min(displayedHours.length, hoursToShow); i++) {
        const forecast = displayedHours[i];
        const date = new Date(forecast.dt * 1000);
        // Format time for display (e.g., "1:00 PM")
        const time = date.toLocaleTimeString('en-NZ', { hour: 'numeric', minute: '2-digit', hour12: true });
        const temp = forecast.main.temp;
        const description = forecast.weather[0].description;
        const iconCode = forecast.weather[0].icon;
        const iconUrl = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
        const tempUnit = UNITS === 'metric' ? '°C' : '°F';

        hourlyForecastDiv.innerHTML += `
            <div class="hourly-item">
                <span class="time">${time}</span>
                <img src="${iconUrl}" alt="${description}" class="weather-icon">
                <span class="temp">${temp.toFixed(0)}${tempUnit}</span>
                <span class="description">${description.charAt(0).toUpperCase() + description.slice(1)}</span>
            </div>
        `;
    }

    if (hourlyForecastDiv.innerHTML === '') {
        hourlyForecastDiv.innerHTML = `<p>No future hourly forecast data available.</p>`;
    }
}

function displayDailyForecast(data) {
    if (!data || !data.list || data.list.length === 0) {
        dailyForecastDiv.innerHTML = `<p>No daily forecast data available.</p>`;
        return;
    }

    dailyForecastDiv.innerHTML = ''; // Clear previous content

    const dailyForecasts = {};

    data.list.forEach(forecast => {
        const date = new Date(forecast.dt * 1000);
        const dayKey = date.toLocaleDateString('en-CA');

        const now = new Date();
        if (date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()) {
             if (forecast.dt * 1000 < now.getTime()) {
                 return;
             }
        }

        if (!dailyForecasts[dayKey]) {
            dailyForecasts[dayKey] = {
                date: date,
                minTemp: forecast.main.temp_min,
                maxTemp: forecast.main.temp_max,
                descriptions: [],
                iconCodes: []
            };
        }

        dailyForecasts[dayKey].minTemp = Math.min(dailyForecasts[dayKey].minTemp, forecast.main.temp_min);
        dailyForecasts[dayKey].maxTemp = Math.max(dailyForecasts[dayKey].maxTemp, forecast.main.temp_max);

        dailyForecasts[dayKey].descriptions.push(forecast.weather[0].description);
        dailyForecasts[dayKey].iconCodes.push(forecast.weather[0].icon);
    });

    function getMostFrequent(arr) {
        if (!arr || arr.length === 0) return '';
        const counts = {};
        let maxCount = 0;
        let mostFrequent = '';
        for (const item of arr) {
            counts[item] = (counts[item] || 0) + 1;
            if (counts[item] > maxCount) {
                maxCount = counts[item];
                mostFrequent = item;
            }
        }
        return mostFrequent;
    }

    const sortedDailyForecasts = Object.values(dailyForecasts).sort((a, b) => a.date - b.date);

    sortedDailyForecasts.forEach(day => {
        if (day.descriptions.length === 0) {
            return;
        }

        const dayOfWeek = day.date.toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' });
        const tempUnit = UNITS === 'metric' ? '°C' : '°F';

        const representativeIconCode = getMostFrequent(day.iconCodes);
        const representativeDescription = getMostFrequent(day.descriptions);
        const iconUrl = `https://openweathermap.org/img/wn/${representativeIconCode}@2x.png`;

        dailyForecastDiv.innerHTML += `
            <div class="weather-day">
                <span>${dayOfWeek}</span>
                <span>
                    <img src="${iconUrl}" alt="${representativeDescription}" class="weather-icon">
                    <span class="temp-min-max">${day.maxTemp.toFixed(0)}${tempUnit}</span> /
                    <span class="temp-min-max">${day.minTemp.toFixed(0)}${tempUnit}</span>
                </span>
                <span>${representativeDescription.charAt(0).toUpperCase() + representativeDescription.slice(1)}</span>
            </div>
        `;
    });
}

// --- Initial Calls ---
initMap(); // Initialize Leaflet map first
// initGooglePlacesSearch() is called by the Google Maps API script directly via its 'callback' parameter