/*
    rdd - https://github.com/latte-soft/rdd

    Copyright (C) 2024-2026 Latte Softworks <latte.to> | MIT License
*/

const basePath = window.location.href.split("?")[0];
const usageMsg = `[*] USAGE: ${basePath}?channel=<CHANNEL_NAME>&binaryType=<BINARY_TYPE>&arch=<ARCH>&version=<VERSION_HASH>

    Binary Types:
    * WindowsPlayer
    * WindowsStudio64
    * MacPlayer
    * MacStudio

    Extra Notes:
    * If \`channel\` isn't provided, it will default to "LIVE" (the production channel)
`;

const hostPath = "https://setup-aws.rbxcdn.com"; // Only the AWS mirror has proper CORS cfg

// CORS proxies to try in order when fetching clientsettings (which blocks direct browser requests)
const corsProxies = [
    url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    url => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

// Root extract locations for the Win manifests
const extractRoots = {
    player: {
        "RobloxApp.zip": "",
        "redist.zip": "",
        "shaders.zip": "shaders/",
        "ssl.zip": "ssl/",

        "WebView2.zip": "",
        "WebView2RuntimeInstaller.zip": "WebView2RuntimeInstaller/",

        "content-avatar.zip": "content/avatar/",
        "content-configs.zip": "content/configs/",
        "content-fonts.zip": "content/fonts/",
        "content-sky.zip": "content/sky/",
        "content-sounds.zip": "content/sounds/",
        "content-textures2.zip": "content/textures/",
        "content-models.zip": "content/models/",

        "content-platform-fonts.zip": "PlatformContent/pc/fonts/",
        "content-platform-dictionaries.zip": "PlatformContent/pc/shared_compression_dictionaries/",
        "content-terrain.zip": "PlatformContent/pc/terrain/",
        "content-textures3.zip": "PlatformContent/pc/textures/",

        "extracontent-luapackages.zip": "ExtraContent/LuaPackages/",
        "extracontent-translations.zip": "ExtraContent/translations/",
        "extracontent-models.zip": "ExtraContent/models/",
        "extracontent-textures.zip": "ExtraContent/textures/",
        "extracontent-places.zip": "ExtraContent/places/"
    },

    studio: {
        "RobloxStudio.zip": "",
        "RibbonConfig.zip": "RibbonConfig/",
        "redist.zip": "",
        "Libraries.zip": "",
        "LibrariesQt5.zip": "",

        "WebView2.zip": "",
        "WebView2RuntimeInstaller.zip": "",

        "shaders.zip": "shaders/",
        "ssl.zip": "ssl/",

        "Qml.zip": "Qml/",
        "Plugins.zip": "Plugins/",
        "StudioFonts.zip": "StudioFonts/",
        "BuiltInPlugins.zip": "BuiltInPlugins/",
        "ApplicationConfig.zip": "ApplicationConfig/",
        "BuiltInStandalonePlugins.zip": "BuiltInStandalonePlugins/",

        "content-qt_translations.zip": "content/qt_translations/",
        "content-sky.zip": "content/sky/",
        "content-fonts.zip": "content/fonts/",
        "content-avatar.zip": "content/avatar/",
        "content-models.zip": "content/models/",
        "content-sounds.zip": "content/sounds/",
        "content-configs.zip": "content/configs/",
        "content-api-docs.zip": "content/api_docs/",
        "content-textures2.zip": "content/textures/",
        "content-studio_svg_textures.zip": "content/studio_svg_textures/",

        "content-platform-fonts.zip": "PlatformContent/pc/fonts/",
        "content-platform-dictionaries.zip": "PlatformContent/pc/shared_compression_dictionaries/",
        "content-terrain.zip": "PlatformContent/pc/terrain/",
        "content-textures3.zip": "PlatformContent/pc/textures/",

        "extracontent-translations.zip": "ExtraContent/translations/",
        "extracontent-luapackages.zip": "ExtraContent/LuaPackages/",
        "extracontent-textures.zip": "ExtraContent/textures/",
        "extracontent-scripts.zip": "ExtraContent/scripts/",
        "extracontent-models.zip": "ExtraContent/models/",

        "studiocontent-models.zip": "StudioContent/models/",
        "studiocontent-textures.zip": "StudioContent/textures/"
    }
};

const binaryTypes = {
    WindowsPlayer: {
        clientSettingsName: "WindowsPlayer",
        blobDirs: {
            "x86-64": "/"
        }
    },
    WindowsStudio64: {
        clientSettingsName: "WindowsStudio64",
        blobDirs: {
            "x86-64": "/"
        }
    },
    MacPlayer: {
        clientSettingsName: "MacPlayer",
        defaultArch: "arm64",
        blobDirs: {
            "arm64": "/mac/arm64/",
            "x86-64": "/mac/"
        }
    },
    MacStudio: {
        clientSettingsName: "MacStudio",
        defaultArch: "arm64",
        blobDirs: {
            "arm64": "/mac/arm64/",
            "x86-64": "/mac/"
        }
    },
};

const urlParams = new URLSearchParams(window.location.search);

const consoleText = document.getElementById("consoleText");
const downloadForm = document.getElementById("downloadForm");
const downloadFormDiv = document.getElementById("downloadFormDiv");
const archSelect = document.getElementById("arch");
const binaryTypeSelect = document.getElementById("binaryType");

function populateArchSelect(binaryTypeName) {
    archSelect.innerHTML = "";
    const binaryTypeObject = binaryTypes[binaryTypeName];
    if (!binaryTypeObject) {
        return;
    }

    const archs = Object.keys(binaryTypeObject.blobDirs);
    for (const archName of archs) {
        const option = document.createElement("option");
        option.value = archName;
        option.text = archName;
        archSelect.appendChild(option);
    }

    if (binaryTypeObject.defaultArch) {
        archSelect.value = binaryTypeObject.defaultArch;
    }
}

binaryTypeSelect.addEventListener("change", function () {
    populateArchSelect(binaryTypeSelect.value);
});

populateArchSelect(binaryTypeSelect.value);

function getPermLink() {
    const channelName = downloadForm.channel.value.trim() || downloadForm.channel.placeholder;
    let queryString = `?channel=${encodeURIComponent(channelName)}&binaryType=${encodeURIComponent(downloadForm.binaryType.value)}`;

    const binaryTypeObj = binaryTypes[downloadForm.binaryType.value];
    const defaultArch = binaryTypeObj.defaultArch || Object.keys(binaryTypeObj.blobDirs)[0];
    if (archSelect.value !== defaultArch) {
        queryString += `&arch=${encodeURIComponent(archSelect.value)}`;
    }

    const versionHash = downloadForm.version.value.trim();
    if (versionHash !== "") {
        queryString += `&version=${encodeURIComponent(versionHash)}`;
    }

    const compressZip = downloadForm.compressZip.checked;
    const compressionLevel = downloadForm.compressionLevel.value;
    if (compressZip === true) {
        queryString += `&compressZip=true&compressionLevel=${compressionLevel}`;
    }

    return basePath + queryString;
}

function downloadFromForm() {
    window.open(getPermLink(), "_self");
}

function copyPermLink() {
    navigator.clipboard.writeText(getPermLink());
}

function scrollToBottom() {
    window.scrollTo({
        top: document.body.scrollHeight
    });
}

function escHtml(originalText) {
    return originalText
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
        .replace(/ /g, "&nbsp;")
        .replace(/\n/g, "<br>");
}

function log(msg = "", end = "\n", autoScroll = true) {
    consoleText.append(msg + end);
    if (autoScroll) {
        scrollToBottom();
    }
}

// Prompt download
function downloadBinaryFile(fileName, data, mimeType = "application/zip") {
    const blob = new Blob([data], { type: mimeType });

    let link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;

    let button = document.createElement("button");
    button.innerText = `${fileName}`;
    link.appendChild(button);

    document.body.appendChild(link);
    scrollToBottom();

    button.click();
}

function requestBinary(url, callback) {
    const httpRequest = new XMLHttpRequest();

    httpRequest.open("GET", url, true);
    httpRequest.responseType = "arraybuffer";

    httpRequest.onload = function () {
        const statusCode = httpRequest.status;
        if (statusCode != 200) {
            log(`[!] Binary request error (${statusCode}) @ ${url}`);
            return;
        }

        const arrayBuffer = httpRequest.response;
        if (!arrayBuffer) {
            log(`[!] Binary request error (${statusCode}) @ ${url} - Failed to get binary ArrayBuffer from response`);
            return;
        }

        callback(arrayBuffer, statusCode);
    };

    httpRequest.onerror = function (e) {
        log(`[!] Binary request error @ ${url} - ${e}`);
    };

    httpRequest.send();
}

function getQuery(queryString) {
    if (!urlParams.has(queryString)) {
        return null;
    }
    return urlParams.get(queryString) || null;
}

// ---------------------------------------------------------------------------
// Auto-fetch version from clientsettings.roblox.com via CORS proxies
// Tries each proxy in order; resolves with the version string or rejects.
// ---------------------------------------------------------------------------
async function fetchVersionAuto(binaryTypeName, channelName) {
    const apiUrl = `https://clientsettings.roblox.com/v2/client-version/${binaryTypeName}/channel/${channelName}`;

    for (let i = 0; i < corsProxies.length; i++) {
        const proxyUrl = corsProxies[i](apiUrl);
        log(`[*] Trying CORS proxy ${i + 1}/${corsProxies.length} to auto-fetch version..`);
        try {
            const resp = await fetch(proxyUrl, { signal: AbortSignal.timeout(8000) });
            if (!resp.ok) {
                log(`[!] Proxy ${i + 1} returned HTTP ${resp.status}, trying next..`);
                continue;
            }

            const json = await resp.json();
            // Response shape: { "version": "version-xxxxxxxxxxxxxxxx", "clientVersionUpload": "...", ... }
            const ver = json.version || json.clientVersionUpload;
            if (ver && ver.startsWith("version-")) {
                log(`[+] Auto-detected version: ${ver}`);
                return ver;
            }

            log(`[!] Proxy ${i + 1} response missing version field, trying next..`);
        } catch (err) {
            log(`[!] Proxy ${i + 1} failed: ${err.message || err}, trying next..`);
        }
    }

    throw new Error("All CORS proxies failed to fetch the version automatically.");
}

// ---------------------------------------------------------------------------

let channel = getQuery("channel");
let version = getQuery("version") || getQuery("guid");
let binaryType = getQuery("binaryType");
let blobDir = getQuery("blobDir");
let arch = getQuery("arch");

let compressZip = getQuery("compressZip");
let compressionLevel = getQuery("compressionLevel");

let channelPath;
let versionPath;

let binExtractRoots;
let zip;

main();

async function main() {
    if (window.location.search === "") {
        downloadFormDiv.hidden = false;
        log(usageMsg, "\n", false);
        return;
    }

    // --- Channel ---
    if (channel !== null) {
        if (channel !== "LIVE") {
            channel = channel.toLowerCase();
        }
    } else {
        channel = "LIVE";
    }

    if (channel === "LIVE") {
        channelPath = `${hostPath}`;
    } else {
        channelPath = `${hostPath}/channel/${channel}`;
    }

    // --- Version normalisation ---
    if (version !== null) {
        version = version.toLowerCase();
        if (!version.startsWith("version-")) {
            version = "version-" + version;
        }
    }

    // Compatibility guard: version without binaryType
    if (version && !binaryType) {
        log("[!] Error: If you provide a specific `version`, you need to set the `binaryType` aswell! See the usage doc below for examples of various `binaryType` inputs:", "\n\n");
        log(usageMsg, "\n", false);
        return;
    }

    // --- blobDir override ---
    if (blobDir !== null && blobDir !== "") {
        if (blobDir.slice(0) !== "/") {
            blobDir = "/" + blobDir;
        }
        if (blobDir.slice(-1) !== "/") {
            blobDir += "/";
        }
    }

    // --- compressZip ---
    if (compressZip !== null) {
        if (compressZip !== "true" && compressZip !== "false") {
            log(`[!] Error: The \`compressZip\` query must be "true" or "false", got "${compressZip}"`);
        }
        compressZip = compressZip === "true";
    } else {
        compressZip = downloadForm.compressZip.checked;
    }

    // --- compressionLevel ---
    if (compressionLevel !== null) {
        try {
            compressionLevel = parseInt(compressionLevel);
        } catch (err) {
            log(`[!] Error: Failed to parse \`compressionLevel\` query: ${err}`, "\n\n");
            log(usageMsg, "\n", false);
            return;
        }

        if (compressionLevel > 9 || compressionLevel < 1) {
            log(`[!] Error: The \`compressionLevel\` query must be a value between 1 and 9, got ${compressionLevel}`, "\n\n");
            log(usageMsg, "\n", false);
            return;
        }
    } else {
        compressionLevel = downloadForm.compressionLevel.value;
    }

    // --- binaryType required from here ---
    if (!binaryType) {
        log("[!] Error: Missing required `binaryType` query, are you using an old perm link for a specific version?", "\n\n");
        log(usageMsg, "\n", false);
        return;
    }

    if (binaryType in binaryTypes) {
        const binaryTypeObject = binaryTypes[binaryType];

        if (!arch) {
            arch = binaryTypeObject.defaultArch || Object.keys(binaryTypeObject.blobDirs)[0];
        }

        if (!blobDir) {
            blobDir = binaryTypeObject.blobDirs[arch];
        }
    } else {
        log(`[!] Error: \`binaryType\` "${binaryType}" not supported. See below for supported \`binaryType\` inputs:`, "\n\n");
        log(usageMsg);
        return;
    }

    // --- Auto-fetch version if not provided ---
    if (!version) {
        const binaryTypeObject = binaryTypes[binaryType];
        const clientSettingsName = binaryTypeObject.clientSettingsName || binaryType;
        const channelNameForApi = channel === "LIVE" ? "LIVE" : channel;

        log(`[*] No version specified — attempting to auto-detect latest version for ${binaryType}@${channel}..`);

        try {
            version = await fetchVersionAuto(clientSettingsName, channelNameForApi);
        } catch (err) {
            // All proxies failed — fall back to the manual form
            log(`[!] Auto-detection failed: ${err.message}`);
            log(`[*] Falling back to manual mode. Copy the version hash from the link below and paste it into the "Version Hash" field, then click Download.\n`);

            const clientSettingsUrl = `https://clientsettings.roblox.com/v2/client-version/${escHtml(clientSettingsName)}/channel/${escHtml(channelNameForApi)}`;
            consoleText.innerHTML += `<a target="_blank" href="${clientSettingsUrl}">${clientSettingsUrl}</a><br><br><br>`;

            downloadForm.channel.value = channel;
            downloadForm.binaryType.value = binaryType;
            populateArchSelect(binaryType);
            archSelect.value = arch;
            downloadForm.compressZip.checked = compressZip;
            downloadForm.compressionLevel.value = compressionLevel;

            downloadFormDiv.hidden = false;
            return;
        }
    }

    fetchManifest();
}

async function fetchManifest() {
    versionPath = `${channelPath}${blobDir}${version}-`;

    if (binaryType === "MacPlayer" || binaryType === "MacStudio") {
        const zipFileName = (binaryType === "MacPlayer" && "RobloxPlayer.zip") || (binaryType === "MacStudio" && "RobloxStudioApp.zip");
        log(`[+] Fetching zip archive for BinaryType "${binaryType}" (${zipFileName})`);

        const outputFileName = `${channel}-${binaryType}-${version}.zip`;
        log(`[+] (Please wait!) Downloading ${outputFileName}..`, "");

        requestBinary(versionPath + zipFileName, function (zipData) {
            log("done!");
            downloadBinaryFile(outputFileName, zipData);
        });
    } else {
        // Windows binary logic
        log(`[+] Fetching rbxPkgManifest for ${version}@${channel}..`);

        var manifestBody = "";
        {
            var resp = await fetch(versionPath + "rbxPkgManifest.txt");
            if (!resp.ok) {
                // Fallback to /channel/common/
                channelPath = `${hostPath}/channel/common`;
                versionPath = `${channelPath}${blobDir}${version}-`;

                resp = await fetch(versionPath + "rbxPkgManifest.txt");
            }

            if (!resp.ok) {
                log(`[!] Failed to fetch rbxPkgManifest: (status: ${resp.status}, err: ${(await resp.text()) || "<failed to get response from server>"})`);
                return;
            }

            manifestBody = await resp.text();
        }

        downloadZipsFromManifest(manifestBody);
    }
}

async function downloadZipsFromManifest(manifestBody) {
    const pkgManifestLines = manifestBody.split("\n").map(line => line.trim());

    if (pkgManifestLines[0] !== "v0") {
        log(`[!] Error: unknown rbxPkgManifest format version; expected "v0", got "${pkgManifestLines[0]}"`);
        return;
    }

    if (pkgManifestLines.includes("RobloxApp.zip")) {
        binExtractRoots = extractRoots.player;

        if (binaryType === "WindowsStudio64") {
            log(`[!] Error: BinaryType \`${binaryType}\` given, but "RobloxApp.zip" was found in the manifest!`);
            return;
        }
    } else if (pkgManifestLines.includes("RobloxStudio.zip")) {
        binExtractRoots = extractRoots.studio;

        if (binaryType === "WindowsPlayer") {
            log(`[!] Error: BinaryType \`${binaryType}\` given, but "RobloxStudio.zip" was found in the manifest!`);
            return;
        }
    } else {
        log("[!] Error: Bad/unrecognized rbxPkgManifest, aborting");
        return;
    }

    log(`[+] Fetching blobs for BinaryType \`${binaryType}\`..`);

    zip = new JSZip();

    // AppSettings.xml required for both Player and Studio
    zip.file("AppSettings.xml", `<?xml version="1.0" encoding="UTF-8"?>
<Settings>
\t<ContentFolder>content</ContentFolder>
\t<BaseUrl>http://www.roblox.com</BaseUrl>
</Settings>
`);

    let threadsLeft = 0;

    function doneCallback() {
        threadsLeft -= 1;
    }

    function getThreadsLeft() {
        return threadsLeft - 1;
    }

    for (const index in pkgManifestLines) {
        const pkgManifestLine = pkgManifestLines[index];
        if (!pkgManifestLine.endsWith(".zip")) {
            continue;
        }

        threadsLeft += 1;
        downloadPackage(pkgManifestLine, doneCallback, getThreadsLeft);
    }

    function checkIfNoThreadsLeft() {
        if (threadsLeft > 0) {
            setTimeout(checkIfNoThreadsLeft, 250);
            return;
        }

        const outputFileName = `${channel}-${binaryType}-${version}.zip`;
        log();
        if (compressZip) {
            log(`[!] NOTE: Compressing final zip (with a compression level of ${compressionLevel}/9), this may take a minute`);
        }

        log(`[+] Exporting assembled zip file "${outputFileName}".. `, "");

        zip.generateAsync({
            type: "arraybuffer",
            compression: compressZip ? "DEFLATE" : "STORE",
            compressionOptions: {
                level: compressionLevel
            }
        }).then(function (outputZipData) {
            zip = null;
            log("done!");
            downloadBinaryFile(outputFileName, outputZipData);
        });
    }

    checkIfNoThreadsLeft();
}

async function downloadPackage(packageName, doneCallback, getThreadsLeft) {
    log(`[+] Fetching "${packageName}"..`);
    const blobUrl = versionPath + packageName;

    requestBinary(blobUrl, async function (blobData) {
        if (packageName in binExtractRoots === false) {
            log(`[*] Package name "${packageName}" not defined in extraction roots for BinaryType \`${binaryType}\`, skipping extraction! (THIS MAY MAKE THE ZIP OUTPUT INCOMPLETE, BE AWARE!)`);
            zip.file(packageName, blobData);
            log(`[+] Moved package "${packageName}" directly to the root folder`);
            doneCallback();
            return;
        }

        log(`[+] Extracting "${packageName}"..`);
        const extractRootFolder = binExtractRoots[packageName];

        await JSZip.loadAsync(blobData).then(async function (packageZip) {
            blobData = null;
            let fileGetPromises = [];

            packageZip.forEach(function (path, object) {
                if (path.endsWith("\\")) {
                    return; // skip directories
                }

                const fixedPath = path.replace(/\\/g, "/");
                const fileGetPromise = object.async("arraybuffer").then(function (data) {
                    zip.file(extractRootFolder + fixedPath, data);
                });

                fileGetPromises.push(fileGetPromise);
            });

            await Promise.all(fileGetPromises);
            packageZip = null;
        });

        log(`[+] Extracted "${packageName}"! (Packages left: ${getThreadsLeft()})`);
        doneCallback();
    });
}
