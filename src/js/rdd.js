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

const hostPath = "https://setup-aws.rbxcdn.com";

// CORS proxies tried in order for auto-fetching version from clientsettings
const corsProxies = [
    url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    url => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

// Root extract locations for Windows manifests
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
        blobDirs: { "x86-64": "/" }
    },
    WindowsStudio64: {
        clientSettingsName: "WindowsStudio64",
        blobDirs: { "x86-64": "/" }
    },
    MacPlayer: {
        clientSettingsName: "MacPlayer",
        defaultArch: "arm64",
        blobDirs: { "arm64": "/mac/arm64/", "x86-64": "/mac/" }
    },
    MacStudio: {
        clientSettingsName: "MacStudio",
        defaultArch: "arm64",
        blobDirs: { "arm64": "/mac/arm64/", "x86-64": "/mac/" }
    },
};

// ---------------------------------------------------------------------------
// DOM refs
// ---------------------------------------------------------------------------
const urlParams        = new URLSearchParams(window.location.search);
const consoleText      = document.getElementById("consoleText");
const downloadForm     = document.getElementById("downloadForm");
const downloadFormDiv  = document.getElementById("downloadFormDiv");
const archSelect       = document.getElementById("arch");
const binaryTypeSelect = document.getElementById("binaryType");

// ---------------------------------------------------------------------------
// Form helpers
// ---------------------------------------------------------------------------
function populateArchSelect(binaryTypeName) {
    archSelect.innerHTML = "";
    const obj = binaryTypes[binaryTypeName];
    if (!obj) return;
    for (const archName of Object.keys(obj.blobDirs)) {
        const option   = document.createElement("option");
        option.value   = archName;
        option.text    = archName;
        archSelect.appendChild(option);
    }
    if (obj.defaultArch) archSelect.value = obj.defaultArch;
}

binaryTypeSelect.addEventListener("change", () => populateArchSelect(binaryTypeSelect.value));
populateArchSelect(binaryTypeSelect.value);

function getPermLink() {
    const channelName = downloadForm.channel.value.trim() || downloadForm.channel.placeholder;
    let qs = `?channel=${encodeURIComponent(channelName)}&binaryType=${encodeURIComponent(downloadForm.binaryType.value)}`;

    const obj         = binaryTypes[downloadForm.binaryType.value];
    const defaultArch = obj.defaultArch || Object.keys(obj.blobDirs)[0];
    if (archSelect.value !== defaultArch) qs += `&arch=${encodeURIComponent(archSelect.value)}`;

    const ver = downloadForm.version.value.trim();
    if (ver) qs += `&version=${encodeURIComponent(ver)}`;

    if (downloadForm.compressZip.checked)
        qs += `&compressZip=true&compressionLevel=${downloadForm.compressionLevel.value}`;

    return basePath + qs;
}

function downloadFromForm() { window.open(getPermLink(), "_self"); }
function copyPermLink()     { navigator.clipboard.writeText(getPermLink()); }

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------
function scrollToBottom() { window.scrollTo({ top: document.body.scrollHeight }); }

function escHtml(text) {
    return text
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#039;")
        .replace(/ /g, "&nbsp;").replace(/\n/g, "<br>");
}

function log(msg = "", end = "\n", autoScroll = true) {
    consoleText.append(msg + end);
    if (autoScroll) scrollToBottom();
}

// ---------------------------------------------------------------------------
// File System Access API
// Opens a save dialog and returns a WritableStream, or null on failure/cancel.
// zip.js ZipWriter accepts a WritableStream directly → data flows to disk
// without accumulating in RAM.
// ---------------------------------------------------------------------------
async function openFSAAStream(fileName) {
    if (!window.showSaveFilePicker) return null; // not supported (Firefox/Safari)
    try {
        const fileHandle = await window.showSaveFilePicker({
            suggestedName: fileName,
            types: [{ description: "ZIP archive", accept: { "application/zip": [".zip"] } }],
        });
        return await fileHandle.createWritable();
    } catch (err) {
        if (err.name === "AbortError") {
            log("[!] Save dialog cancelled.");
        } else {
            log(`[!] FSAA unavailable: ${err.message} — using in-memory fallback.`);
        }
        return null;
    }
}

// ---------------------------------------------------------------------------
// Simple arraybuffer fetch
// ---------------------------------------------------------------------------
function fetchBinary(url) {
    return new Promise((resolve, reject) => {
        const xhr      = new XMLHttpRequest();
        xhr.open("GET", url, true);
        xhr.responseType = "arraybuffer";
        xhr.onload = () => {
            if (xhr.status !== 200) return reject(new Error(`HTTP ${xhr.status} @ ${url}`));
            if (!xhr.response)      return reject(new Error(`Empty response @ ${url}`));
            resolve(xhr.response);
        };
        xhr.onerror = e => reject(new Error(`Network error @ ${url}`));
        xhr.send();
    });
}

// ---------------------------------------------------------------------------
// Auto-fetch version via CORS proxy
// ---------------------------------------------------------------------------
async function fetchVersionAuto(binaryTypeName, channelName) {
    const apiUrl = `https://clientsettings.roblox.com/v2/client-version/${binaryTypeName}/channel/${channelName}`;

    for (let i = 0; i < corsProxies.length; i++) {
        log(`[*] Trying CORS proxy ${i + 1}/${corsProxies.length} to auto-fetch version..`);
        try {
            const resp = await fetch(corsProxies[i](apiUrl), { signal: AbortSignal.timeout(8000) });
            if (!resp.ok) { log(`[!] Proxy ${i + 1} returned HTTP ${resp.status}, trying next..`); continue; }
            const json = await resp.json();
            const ver  = json.version || json.clientVersionUpload;
            if (ver?.startsWith("version-")) { log(`[+] Auto-detected version: ${ver}`); return ver; }
            log(`[!] Proxy ${i + 1}: missing version field, trying next..`);
        } catch (err) {
            log(`[!] Proxy ${i + 1} failed: ${err.message || err}, trying next..`);
        }
    }
    throw new Error("All CORS proxies failed.");
}

// ---------------------------------------------------------------------------
// Query param helper
// ---------------------------------------------------------------------------
function getQuery(key) { return urlParams.has(key) ? (urlParams.get(key) || null) : null; }

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let channel, version, binaryType, blobDir, arch, compressZip, compressionLevel;
let channelPath, versionPath, binExtractRoots;

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
main();

async function main() {
    if (window.location.search === "") {
        downloadFormDiv.hidden = false;
        log(usageMsg, "\n", false);
        return;
    }

    // channel
    channel = getQuery("channel") ?? "LIVE";
    if (channel !== "LIVE") channel = channel.toLowerCase();
    channelPath = channel === "LIVE" ? hostPath : `${hostPath}/channel/${channel}`;

    // version
    version = getQuery("version") || getQuery("guid");
    if (version) {
        version = version.toLowerCase();
        if (!version.startsWith("version-")) version = "version-" + version;
    }
    if (version && !getQuery("binaryType")) {
        log("[!] Error: `version` provided without `binaryType`. See usage below:", "\n\n");
        log(usageMsg, "\n", false);
        return;
    }

    // blobDir override
    blobDir = getQuery("blobDir");
    if (blobDir) {
        if (!blobDir.startsWith("/")) blobDir = "/" + blobDir;
        if (!blobDir.endsWith("/"))   blobDir += "/";
    }

    // compressZip
    const czRaw = getQuery("compressZip");
    if (czRaw !== null) {
        if (czRaw !== "true" && czRaw !== "false") { log(`[!] Error: \`compressZip\` must be "true" or "false".`); return; }
        compressZip = czRaw === "true";
    } else {
        compressZip = downloadForm.compressZip.checked;
    }

    // compressionLevel
    const clRaw = getQuery("compressionLevel");
    if (clRaw !== null) {
        compressionLevel = parseInt(clRaw);
        if (isNaN(compressionLevel) || compressionLevel < 1 || compressionLevel > 9) {
            log(`[!] Error: \`compressionLevel\` must be 1-9.`, "\n\n"); log(usageMsg, "\n", false); return;
        }
    } else {
        compressionLevel = parseInt(downloadForm.compressionLevel.value);
    }

    // binaryType
    binaryType = getQuery("binaryType");
    if (!binaryType) { log("[!] Error: Missing required `binaryType` query.", "\n\n"); log(usageMsg, "\n", false); return; }
    if (!(binaryType in binaryTypes)) { log(`[!] Error: Unsupported \`binaryType\` "${binaryType}".`, "\n\n"); log(usageMsg); return; }

    const btObj = binaryTypes[binaryType];
    arch    = getQuery("arch") || btObj.defaultArch || Object.keys(btObj.blobDirs)[0];
    blobDir = blobDir || btObj.blobDirs[arch];

    // Auto-detect version if not provided
    if (!version) {
        const csName = btObj.clientSettingsName || binaryType;
        const csChan = channel === "LIVE" ? "LIVE" : channel;
        log(`[*] No version specified — auto-detecting latest for ${binaryType}@${channel}..`);
        try {
            version = await fetchVersionAuto(csName, csChan);
        } catch (err) {
            log(`[!] Auto-detection failed: ${err.message}`);
            log(`[*] Manual fallback — open the link below, copy the version hash, paste into "Version Hash":\n`);
            const apiUrl = `https://clientsettings.roblox.com/v2/client-version/${escHtml(csName)}/channel/${escHtml(csChan)}`;
            consoleText.innerHTML += `<a target="_blank" href="${apiUrl}">${apiUrl}</a><br><br><br>`;
            downloadForm.channel.value          = channel;
            downloadForm.binaryType.value       = binaryType;
            populateArchSelect(binaryType);
            archSelect.value                    = arch;
            downloadForm.compressZip.checked    = compressZip;
            downloadForm.compressionLevel.value = compressionLevel;
            downloadFormDiv.hidden              = false;
            return;
        }
    }

    fetchManifest();
}

// ---------------------------------------------------------------------------
// Fetch manifest
// ---------------------------------------------------------------------------
async function fetchManifest() {
    versionPath = `${channelPath}${blobDir}${version}-`;

    // Mac: single zip file, just pass-through download
    if (binaryType === "MacPlayer" || binaryType === "MacStudio") {
        const zipFileName = binaryType === "MacPlayer" ? "RobloxPlayer.zip" : "RobloxStudioApp.zip";
        const outputName  = `${channel}-${binaryType}-${version}.zip`;
        log(`[+] Fetching zip for BinaryType "${binaryType}" (${zipFileName})`);
        log(`[+] Downloading ${outputName}..`, "");
        try {
            const data = await fetchBinary(versionPath + zipFileName);
            log("done!");
            triggerBlobDownload(outputName, data);
        } catch (err) {
            log(`\n[!] Failed: ${err.message}`);
        }
        return;
    }

    // Windows: pkg manifest
    log(`[+] Fetching rbxPkgManifest for ${version}@${channel}..`);
    let resp = await fetch(versionPath + "rbxPkgManifest.txt");
    if (!resp.ok) {
        channelPath = `${hostPath}/channel/common`;
        versionPath = `${channelPath}${blobDir}${version}-`;
        resp        = await fetch(versionPath + "rbxPkgManifest.txt");
    }
    if (!resp.ok) { log(`[!] Failed to fetch rbxPkgManifest (HTTP ${resp.status})`); return; }

    await assembleZip(await resp.text());
}

// ---------------------------------------------------------------------------
// Trigger a blob-based browser download (FSAA fallback)
// ---------------------------------------------------------------------------
function triggerBlobDownload(fileName, data) {
    const blob   = new Blob([data], { type: "application/zip" });
    const link   = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: fileName });
    const button = document.createElement("button");
    button.innerText = fileName;
    link.appendChild(button);
    document.body.appendChild(link);
    scrollToBottom();
    button.click();
}

// ---------------------------------------------------------------------------
// Core assembly: parse manifest → download each package → extract → repack
//
// Output routing:
//   Chrome/Edge  → File System Access API WritableStream (streamed to disk, ~0 RAM)
//   Firefox/Safari → zip.js BlobWriter (in-memory, then blob download)
// ---------------------------------------------------------------------------
async function assembleZip(manifestBody) {
    const lines = manifestBody.split("\n").map(l => l.trim()).filter(Boolean);

    if (lines[0] !== "v0") { log(`[!] Unknown manifest version "${lines[0]}"`); return; }

    if (lines.includes("RobloxApp.zip")) {
        if (binaryType === "WindowsStudio64") { log(`[!] Manifest mismatch: "RobloxApp.zip" found for Studio type.`); return; }
        binExtractRoots = extractRoots.player;
    } else if (lines.includes("RobloxStudio.zip")) {
        if (binaryType === "WindowsPlayer") { log(`[!] Manifest mismatch: "RobloxStudio.zip" found for Player type.`); return; }
        binExtractRoots = extractRoots.studio;
    } else {
        log("[!] Unrecognized rbxPkgManifest, aborting."); return;
    }

    const packageNames = lines.filter(l => l.endsWith(".zip"));
    const outputName   = `${channel}-${binaryType}-${version}.zip`;

    log(`[+] ${packageNames.length} package(s) to process for \`${binaryType}\`.`);

    // --- Open output stream ---
    const fsaaStream = await openFSAAStream(outputName);
    const useFSAA    = fsaaStream !== null;

    log(useFSAA
        ? "[+] File System Access API active — streaming directly to disk (very low RAM usage)."
        : "[+] In-memory mode — entire zip will be held in RAM before download."
    );

    // zip.js options
    // When compressZip is false we use STORE (no compression, fastest).
    // When true we use DEFLATE with the user-chosen level.
    const zipOptions = compressZip
        ? { bufferedWrite: true, level: compressionLevel }   // DEFLATE
        : { bufferedWrite: true, level: 0 };                 // STORE (level 0 = no compression)

    const zipWriter = useFSAA
        ? new zip.ZipWriter(fsaaStream, zipOptions)
        : new zip.ZipWriter(new zip.BlobWriter("application/zip"), zipOptions);

    // Add AppSettings.xml
    const appSettingsXml = `<?xml version="1.0" encoding="UTF-8"?>
<Settings>
\t<ContentFolder>content</ContentFolder>
\t<BaseUrl>http://www.roblox.com</BaseUrl>
</Settings>
`;
    await zipWriter.add("AppSettings.xml", new zip.TextReader(appSettingsXml));

    // Process packages sequentially to keep RAM usage predictable.
    // (Each package's raw buffer is freed before the next is downloaded.)
    let remaining = packageNames.length;

    for (const packageName of packageNames) {
        log(`[+] Fetching "${packageName}"..`);
        let rawBuffer;
        try {
            rawBuffer = await fetchBinary(versionPath + packageName);
        } catch (err) {
            log(`[!] Failed to fetch "${packageName}": ${err.message} — skipping.`);
            remaining--;
            continue;
        }

        if (!(packageName in binExtractRoots)) {
            // Not in extract map — add as-is to zip root
            log(`[*] "${packageName}" not in extract roots — adding to root as-is.`);
            await zipWriter.add(packageName, new zip.Uint8ArrayReader(new Uint8Array(rawBuffer)));
            rawBuffer = null;
            remaining--;
            log(`[+] Added "${packageName}". (${remaining} left)`);
            continue;
        }

        // Extract inner zip and re-add each file under the correct path prefix
        log(`[+] Extracting "${packageName}"..`);
        const extractRoot    = binExtractRoots[packageName];
        const innerZipReader = new zip.ZipReader(new zip.Uint8ArrayReader(new Uint8Array(rawBuffer)));
        rawBuffer            = null; // free the raw download buffer immediately

        try {
            const entries = await innerZipReader.getEntries();
            for (const entry of entries) {
                if (entry.directory) continue;
                const destPath  = extractRoot + entry.filename.replace(/\\/g, "/");
                const entryData = await entry.getData(new zip.Uint8ArrayWriter());
                await zipWriter.add(destPath, new zip.Uint8ArrayReader(entryData));
            }
        } catch (err) {
            log(`[!] Extraction error for "${packageName}": ${err.message}`);
        } finally {
            await innerZipReader.close();
        }

        remaining--;
        log(`[+] Extracted "${packageName}"! (${remaining} left)`);
    }

    // Finalise zip
    if (compressZip) log(`[!] NOTE: DEFLATE compression level ${compressionLevel}/9 applied.`);
    log(`[+] Finalising "${outputName}".. `, "");

    if (useFSAA) {
        await zipWriter.close(); // flushes central dir + closes WritableStream to disk
        log("done! File saved directly to disk.");
    } else {
        const blob = await zipWriter.close(); // returns Blob
        log("done!");
        triggerBlobDownload(outputName, await blob.arrayBuffer());
    }
}
