import express from 'express';

import fs from 'fs';
import sharp from 'sharp';

import path from 'path';

import { fileURLToPath } from 'url';

import 'dotenv/config';

import { analyzeEngineeringCase } from './engineeringAI.js';
import * as turf from '@turf/turf';

import {
    initialize as initializeIrrigationAI,
    decide as irrigationAIDecide,
    learn as irrigationAILearn
} from './irrigation-ai-agent.js';













// ======================================================
// Copernicus Authentication
// ======================================================

async function getCopernicusAccessToken() {
    const tokenUrl =
        'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token';

    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            console.log(
                `🔐 Copernicus authentication attempt ${attempt}/${maxAttempts}...`
            );

            const response = await fetch(
                tokenUrl,
                {
                    method: 'POST',

                    headers: {
                        'Content-Type':
                            'application/x-www-form-urlencoded'
                    },

                    body:
                        new URLSearchParams({
                            grant_type:
                                'client_credentials',

                            client_id:
                                process.env.COPERNICUS_CLIENT_ID,

                            client_secret:
                                process.env.COPERNICUS_CLIENT_SECRET
                        }),

                    signal:
                        AbortSignal.timeout(30000)
                }
            );

            if (!response.ok) {
                const errorText =
                    await response.text();

                throw new Error(
                    `Copernicus authentication failed: ${response.status} ${errorText}`
                );
            }

            const data =
                await response.json();

            if (!data.access_token) {
                throw new Error(
                    'Copernicus did not return an access token.'
                );
            }

            console.log(
                '✅ Copernicus access token received successfully.'
            );

            return data.access_token;

        } catch (error) {
            console.error(
                `❌ Copernicus authentication attempt ${attempt}/${maxAttempts} failed:`,
                error
            );

            if (attempt === maxAttempts) {
                throw new Error(
                    `Copernicus authentication failed after ${maxAttempts} attempts: ${error.message}`
                );
            }

            const waitMs = attempt * 3000;

            console.log(
                `⏳ Retrying Copernicus authentication in ${waitMs / 1000}s...`
            );

            await new Promise(resolve =>
                setTimeout(resolve, waitMs)
            );
        }
    }
}


async function analyzeSatelliteChange(
    baselineFilePath,
    currentFilePath,
    bbox,
    bufferGeometry
)
{

    const { fromFile } = await import('geotiff');


async function readRaster(filePath) {

    const tiff =
        await fromFile(filePath);

    const image =
        await tiff.getImage();

    const rasters =
        await image.readRasters();

    return {
        width:
            image.getWidth(),

        height:
            image.getHeight(),

        blue:
            rasters[0],

        green:
            rasters[1],

        red:
            rasters[2],

        nir:
            rasters[3],

        swir1:
            rasters[4]
    };
}

    const baseline =
        await readRaster(
            baselineFilePath
        );

    const current =
        await readRaster(
            currentFilePath
        );

    if (
        baseline.width !== current.width ||
        baseline.height !== current.height
    ) {
        throw new Error(
            'Baseline and current rasters have different dimensions.'
        );
    }

    const totalPixels =
        baseline.width *
        baseline.height;

        


// ======================================================
// REAL BUFFER MASK
// ======================================================

let analyzedPixels = 0;

function pixelIsInsideBuffer(index) {

    const x =
        index % baseline.width;

    const y =
        Math.floor(
            index / baseline.width
        );

    const [
        minLng,
        minLat,
        maxLng,
        maxLat
    ] = bbox;

    const lng =
        minLng +
        (
            (x + 0.5) /
            baseline.width
        ) *
        (maxLng - minLng);

    const lat =
        maxLat -
        (
            (y + 0.5) /
            baseline.height
        ) *
        (maxLat - minLat);

    const point =
        turf.point([
            lng,
            lat
        ]);

    return turf.booleanPointInPolygon(
        point,
        bufferGeometry
    );
}


        const waterVegetationMask = new Uint8Array(totalPixels);

        // ======================================================
// REAL PIXEL-LEVEL CHANGE MASK
// كل Pixel متغير يحتفظ بموقعه الحقيقي داخل الـ AOI
// ======================================================
const changedPixelMask = new Uint8Array(totalPixels);

    // ======================================================
    // NDVI CHANGE
    // ======================================================

    const changeThreshold =
    -0.18;
    let validPixels = 0;
    let changedPixels = 0;

    let baselineNdviSum = 0;
    let currentNdviSum = 0;
    let deltaSum = 0;

    let minDelta =
        Infinity;

    let maxDelta =
        -Infinity;

    // ======================================================
    // WATER HYACINTH CANDIDATE DETECTION
    // ======================================================

    /*
        Initial engineering heuristic:

        NDWI  = (Green - NIR) / (Green + NIR)
        NDVI  = (NIR - Red) / (NIR + Red)

        Candidate:
        - water-like pixel
        - vegetation-like pixel

        IMPORTANT:
        This is NOT species-level identification.
        It produces waterHyacinthCandidate areas.
    */

    const waterThreshold =
        0.00;

    const vegetationThreshold =
        0.20;

    let baselineWaterPixels = 0;
    let currentWaterPixels = 0;

    let baselineHyacinthPixels = 0;
    let currentHyacinthPixels = 0;

    let baselineHyacinthAreaPixels = 0;
    let currentHyacinthAreaPixels = 0;

    let baselineWaterVegetationPixels = 0;
    let currentWaterVegetationPixels = 0;

    let hyacinthNewPixels = 0;
    let hyacinthLostPixels = 0;

let currentWaterNdviSum = 0;
let currentWaterNdviMin = Infinity;
let currentWaterNdviMax = -Infinity;

let currentWaterNdviBelowZero = 0;
let currentWaterNdviZeroTo02 = 0;
let currentWaterNdvi02To04 = 0;
let currentWaterNdviAbove04 = 0;


// ======================================================
// RAW CURRENT NDWI DIAGNOSTICS
// ======================================================

let currentNdwiSum = 0;
let currentNdwiMin = Infinity;
let currentNdwiMax = -Infinity;

let currentNdwiBelowMinus02 = 0;
let currentNdwiMinus02To0 = 0;
let currentNdwiZeroTo02 = 0;
let currentNdwiAbove02 = 0;


    for (
        let i = 0;
        i < totalPixels;
        i++
    ) {

                if (
            bufferGeometry &&
            !pixelIsInsideBuffer(i)
        ) {
            continue;
        }

        analyzedPixels++;
        const greenBaseline =
            Number(
                baseline.green[i]
            );

        const redBaseline =
            Number(
                baseline.red[i]
            );

        const nirBaseline =
            Number(
                baseline.nir[i]
            );

        const greenCurrent =
            Number(
                current.green[i]
            );

        const redCurrent =
            Number(
                current.red[i]
            );

        const nirCurrent =
            Number(
                current.nir[i]
            );

        // ----------------------------------------------
        // Validate
        // ----------------------------------------------

        if (
            !Number.isFinite(greenBaseline) ||
            !Number.isFinite(redBaseline) ||
            !Number.isFinite(nirBaseline) ||
            !Number.isFinite(greenCurrent) ||
            !Number.isFinite(redCurrent) ||
            !Number.isFinite(nirCurrent)
        ) {
            continue;
        }

        // ==================================================
        // NDVI
        // ==================================================

        const baselineNdviDenominator =
            nirBaseline +
            redBaseline;

        const currentNdviDenominator =
            nirCurrent +
            redCurrent;

        if (
            baselineNdviDenominator === 0 ||
            currentNdviDenominator === 0
        ) {
            continue;
        }

        const baselineNdvi =
            (
                nirBaseline -
                redBaseline
            ) /
            baselineNdviDenominator;

        const currentNdvi =
            (
                nirCurrent -
                redCurrent
            ) /
            currentNdviDenominator;

        const deltaNdvi =
            currentNdvi -
            baselineNdvi;

        validPixels++;

        baselineNdviSum +=
            baselineNdvi;

        currentNdviSum +=
            currentNdvi;

        deltaSum +=
            deltaNdvi;

        minDelta =
            Math.min(
                minDelta,
                deltaNdvi
            );

        maxDelta =
            Math.max(
                maxDelta,
                deltaNdvi
            );

    // ======================================================
// PROFESSIONAL CHANGE DETECTION
// ======================================================

// التغير الحقيقي لازم يكون:
// 1. انخفاض NDVI واضح
// 2. قيمة NDVI الحالية أقل من السابقة
// 3. التغير ليس مجرد اختلاف بسيط
// 4. المنطقة داخل نطاق التحليل الحقيقي

const significantNdviDrop =
    deltaNdvi <= changeThreshold;

const strongVegetationLoss =
    baselineNdvi >= 0.25 &&
    currentNdvi <= baselineNdvi - 0.18;

const realChangePixel =
    significantNdviDrop &&
    strongVegetationLoss;

if (realChangePixel) {

    changedPixels++;

    changedPixelMask[i] = 1;
}
       // ==================================================
        // NDWI
        // ==================================================

        const baselineNdwiDenominator =
            greenBaseline +
            nirBaseline;

        const currentNdwiDenominator =
            greenCurrent +
            nirCurrent;

        if (
            baselineNdwiDenominator === 0 ||
            currentNdwiDenominator === 0
        ) {
            continue;
        }

        const baselineNdwi =
            (
                greenBaseline -
                nirBaseline
            ) /
            baselineNdwiDenominator;

        const currentNdwi =
            (
                greenCurrent -
                nirCurrent
            ) /
            currentNdwiDenominator;



            // ======================================================
// RAW CURRENT NDWI DIAGNOSTICS
// ======================================================

currentNdwiSum += currentNdwi;

currentNdwiMin =
    Math.min(
        currentNdwiMin,
        currentNdwi
    );

currentNdwiMax =
    Math.max(
        currentNdwiMax,
        currentNdwi
    );

if (currentNdwi < -0.20) {
    currentNdwiBelowMinus02++;
}
else if (currentNdwi < 0) {
    currentNdwiMinus02To0++;
}
else if (currentNdwi < 0.20) {
    currentNdwiZeroTo02++;
}
else {
    currentNdwiAbove02++;
}

      // ==================================================
// Water mask
// ==================================================
const baselineIsWater =
    baselineNdwi >
    waterThreshold;

const currentIsWater =
    currentNdwi >
    waterThreshold;

if (baselineIsWater) {
    baselineWaterPixels++;
}

if (currentIsWater) {
    currentWaterPixels++;

    currentWaterNdviSum += currentNdvi;

    currentWaterNdviMin =
        Math.min(
            currentWaterNdviMin,
            currentNdvi
        );

    currentWaterNdviMax =
        Math.max(
            currentWaterNdviMax,
            currentNdvi
        );

    if (currentNdvi < 0) {
        currentWaterNdviBelowZero++;
    }
    else if (currentNdvi < 0.20) {
        currentWaterNdviZeroTo02++;
    }
    else if (currentNdvi < 0.40) {
        currentWaterNdvi02To04++;
    }
    else {
        currentWaterNdviAbove04++;
    }
}
        

        // ==================================================
        // Water + Vegetation
        // ==================================================

        const baselineVegetatedWater =
            baselineIsWater &&
            baselineNdvi >
                vegetationThreshold;

        const currentVegetatedWater =
    currentIsWater &&
    currentNdvi > vegetationThreshold;

if (currentVegetatedWater) {
    waterVegetationMask[i] = 1;
}

        if (baselineVegetatedWater) {
            baselineWaterVegetationPixels++;
            baselineHyacinthPixels++;
        }

        if (currentVegetatedWater) {
            currentWaterVegetationPixels++;
            currentHyacinthPixels++;
        }

        if (
            baselineVegetatedWater
        ) {
            baselineHyacinthAreaPixels++;
        }

        if (
            currentVegetatedWater
        ) {
            currentHyacinthAreaPixels++;
        }

        // ==================================================
        // New / Lost Candidate
        // ==================================================

        if (
            !baselineVegetatedWater &&
            currentVegetatedWater
        ) {
            hyacinthNewPixels++;
        }

        if (
            baselineVegetatedWater &&
            !currentVegetatedWater
        ) {
            hyacinthLostPixels++;
        }
    }



  // ======================================================
// REAL CHANGE GEOMETRY FROM PIXEL MASK
// ======================================================
// تحويل الـ changed pixels إلى GeoJSON حقيقي
// بنفس إحداثيات Sentinel-2.
// لا يوجد Circle صناعي.
// ======================================================

function buildChangeGeometryFromMask(
    mask,
    width,
    height,
    rasterBbox
) {

    const [
        rasterMinLng,
        rasterMinLat,
        rasterMaxLng,
        rasterMaxLat
    ] = rasterBbox;

    const rectangles = [];
    const rowRuns = [];

    // ==================================================
    // استخراج الـ changed runs لكل Row
    // ==================================================

    for (let y = 0; y < height; y++) {

        const runs = [];
        let runStart = -1;

        for (let x = 0; x < width; x++) {

            const changed =
                mask[y * width + x] === 1;

            if (
                changed &&
                runStart < 0
            ) {
                runStart = x;
            }

            if (
                (!changed || x === width - 1) &&
                runStart >= 0
            ) {

                const runEnd =
                    changed && x === width - 1
                        ? x + 1
                        : x;

                runs.push({
                    x1: runStart,
                    x2: runEnd
                });

                runStart = -1;
            }
        }

        rowRuns.push(runs);
    }

    // ==================================================
    // دمج الـ Runs المتطابقة رأسيًا
    // ==================================================

    const active = new Map();

    for (let y = 0; y < height; y++) {

        const currentKeys = new Set();

        for (const run of rowRuns[y]) {

            const key =
                `${run.x1}:${run.x2}`;

            currentKeys.add(key);

            const existing =
                active.get(key);

            if (existing) {

                existing.y2 =
                    y + 1;

            } else {

                active.set(
                    key,
                    {
                        x1: run.x1,
                        x2: run.x2,
                        y1: y,
                        y2: y + 1
                    }
                );

            }
        }

        // أي منطقة انتهت
        for (const [key, rect] of active) {

            if (!currentKeys.has(key)) {

                rectangles.push(rect);

                active.delete(key);
            }
        }
    }

    // Flush
    for (const rect of active.values()) {
        rectangles.push(rect);
    }

    // ==================================================
    // تحويل الـ Pixels إلى GeoJSON
    // ==================================================

    const features =
        rectangles.map(
            rect => {

                const lng1 =
                    rasterMinLng +
                    (rect.x1 / width) *
                    (
                        rasterMaxLng -
                        rasterMinLng
                    );

                const lng2 =
                    rasterMinLng +
                    (rect.x2 / width) *
                    (
                        rasterMaxLng -
                        rasterMinLng
                    );

                const latTop =
                    rasterMaxLat -
                    (rect.y1 / height) *
                    (
                        rasterMaxLat -
                        rasterMinLat
                    );

                const latBottom =
                    rasterMaxLat -
                    (rect.y2 / height) *
                    (
                        rasterMaxLat -
                        rasterMinLat
                    );

                return turf.polygon([
                    [
                        [lng1, latTop],
                        [lng2, latTop],
                        [lng2, latBottom],
                        [lng1, latBottom],
                        [lng1, latTop]
                    ]
                ]);

            }
        );

    return turf.featureCollection(
        features
    );
}


// ======================================================
// REAL CHANGE GEOMETRY
// ======================================================

const changeGeometry =
    buildChangeGeometryFromMask(
        changedPixelMask,
        baseline.width,
        baseline.height,
        bbox
    );

// ======================================================
// REMOVE SMALL CHANGE NOISE
// ======================================================

const cleanedChangeMask =
    new Uint8Array(totalPixels);

const visitedChange =
    new Uint8Array(totalPixels);

const MIN_CHANGE_CLUSTER_PIXELS = 12;

for (
    let start = 0;
    start < totalPixels;
    start++
) {

    if (
        changedPixelMask[start] !== 1 ||
        visitedChange[start] === 1
    ) {
        continue;
    }

    const queue = [start];

    visitedChange[start] = 1;

    const cluster = [];

    while (queue.length > 0) {

        const current =
            queue.pop();

        cluster.push(current);

        const x =
            current % baseline.width;

        const y =
            Math.floor(
                current / baseline.width
            );

        for (
            let dy = -1;
            dy <= 1;
            dy++
        ) {

            for (
                let dx = -1;
                dx <= 1;
                dx++
            ) {

                if (
                    dx === 0 &&
                    dy === 0
                ) {
                    continue;
                }

                const nx =
                    x + dx;

                const ny =
                    y + dy;

                if (
                    nx < 0 ||
                    nx >= baseline.width ||
                    ny < 0 ||
                    ny >= baseline.height
                ) {
                    continue;
                }

                const ni =
                    ny *
                    baseline.width +
                    nx;

                if (
                    changedPixelMask[ni] === 1 &&
                    visitedChange[ni] === 0
                ) {

                    visitedChange[ni] = 1;

                    queue.push(ni);
                }
            }
        }
    }

    // نحتفظ فقط بالتغيرات الحقيقية المتصلة
    if (
        cluster.length >=
        MIN_CHANGE_CLUSTER_PIXELS
    ) {

        for (
            const pixelIndex of cluster
        ) {

            cleanedChangeMask[
                pixelIndex
            ] = 1;
        }
    }
}

// استبدال الـmask الأصلي بالـclean mask

for (
    let i = 0;
    i < totalPixels;
    i++
) {

    changedPixelMask[i] =
        cleanedChangeMask[i];
}

// ======================================================
// SPATIAL CLUSTERING
// ======================================================

const visited =
    new Uint8Array(totalPixels);

let clusterCount = 0;
let largestClusterPixels = 0;
let clusteredCandidatePixels = 0;

const clusterSizes = [];

for (
    let start = 0;
    start < totalPixels;
    start++
) {

    if (
        waterVegetationMask[start] === 0 ||
        visited[start] === 1
    ) {
        continue;
    }

    clusterCount++;

    const queue = [start];

    visited[start] = 1;

    let clusterSize = 0;

    while (queue.length > 0) {

        const currentIndex =
            queue.pop();

        clusterSize++;

        const x =
            currentIndex %
            baseline.width;

        const y =
            Math.floor(
                currentIndex /
                baseline.width
            );

        // 8-neighbor connectivity
        for (
            let dy = -1;
            dy <= 1;
            dy++
        ) {

            for (
                let dx = -1;
                dx <= 1;
                dx++
            ) {

                if (
                    dx === 0 &&
                    dy === 0
                ) {
                    continue;
                }

                const nx =
                    x + dx;

                const ny =
                    y + dy;

                if (
                    nx < 0 ||
                    nx >= baseline.width ||
                    ny < 0 ||
                    ny >= baseline.height
                ) {
                    continue;
                }

                const neighborIndex =
                    ny *
                    baseline.width +
                    nx;

                if (
                    waterVegetationMask[
                        neighborIndex
                    ] === 1 &&
                    visited[
                        neighborIndex
                    ] === 0
                ) {

                    visited[
                        neighborIndex
                    ] = 1;

                    queue.push(
                        neighborIndex
                    );
                }
            }
        }
    }

    clusterSizes.push(
        clusterSize
    );

    largestClusterPixels =
        Math.max(
            largestClusterPixels,
            clusterSize
        );

    clusteredCandidatePixels +=
        clusterSize;
}

    // ======================================================
    // General NDVI results
    // ======================================================

    const meanBaselineNDVI =
        validPixels
            ? baselineNdviSum /
              validPixels
            : 0;

    const meanCurrentNDVI =
        validPixels
            ? currentNdviSum /
              validPixels
            : 0;

    const meanDeltaNDVI =
        validPixels
            ? deltaSum /
              validPixels
            : 0;

    const changePercentage =
        validPixels
            ? (
                changedPixels /
                validPixels
            ) * 100
            : 0;

  
// ======================================================
// AOI AREA FROM REAL BBOX
// ======================================================

const [
    minLng,
    minLat,
    maxLng,
    maxLat
] = bbox;

const latitudeMetersPerDegree =
    111320;

const midLat =
    (minLat + maxLat) / 2;

const longitudeMetersPerDegree =
    111320 *
    Math.cos(
        midLat *
        Math.PI /
        180
    );

const aoiWidthMeters =
    (maxLng - minLng) *
    longitudeMetersPerDegree;

const aoiHeightMeters =
    (maxLat - minLat) *
    latitudeMetersPerDegree;

const aoiAreaM2 =
    aoiWidthMeters *
    aoiHeightMeters;

const pixelAreaM2 =
    totalPixels > 0
        ? aoiAreaM2 / totalPixels
        : 0;

// ======================================================
// FINAL REAL CHANGE AREA
// ======================================================

let finalChangedPixels = 0;

for (
    let i = 0;
    i < totalPixels;
    i++
) {

    if (
        changedPixelMask[i] === 1
    ) {

        finalChangedPixels++;
    }
}

const changedAreaM2 =
    finalChangedPixels *
    pixelAreaM2;



    
    // ======================================================
    // Water Hyacinth Results
    // ======================================================

    const baselineHyacinthAreaM2 =
        baselineHyacinthAreaPixels *
        pixelAreaM2;

    const currentHyacinthAreaM2 =
        currentHyacinthAreaPixels *
        pixelAreaM2;

    const newHyacinthAreaM2 =
        hyacinthNewPixels *
        pixelAreaM2;

    const lostHyacinthAreaM2 =
        hyacinthLostPixels *
        pixelAreaM2;

    const growthPercentage =
        baselineHyacinthAreaM2 > 0
            ? (
                (
                    currentHyacinthAreaM2 -
                    baselineHyacinthAreaM2
                ) /
                baselineHyacinthAreaM2
            ) * 100
            : currentHyacinthAreaM2 > 0
                ? 100
                : 0;

    const coveragePercentage =
        totalPixels > 0
            ? (
                currentHyacinthAreaPixels /
                totalPixels
            ) * 100
            : 0;

    let trend =
        'stable';

    if (
        growthPercentage >= 10
    ) {
        trend =
            'increasing';
    }
    else if (
        growthPercentage <= -10
    ) {
        trend =
            'decreasing';
    }

    const waterHyacinthDetected =
        currentHyacinthAreaPixels > 0;

    /*
        Confidence هنا Confidence أولية للـ candidate detector.
        مش species classification confidence.
    */

    let confidence = 0;

    if (
        waterHyacinthDetected
    ) {
        confidence += 40;
    }

    if (
        currentWaterPixels > 0
    ) {
        confidence += 20;
    }

    if (
        coveragePercentage >= 1
    ) {
        confidence += 20;
    }

    if (
        growthPercentage > 0
    ) {
        confidence += 20;
    }

   confidence = Math.min(100, confidence);

const currentWaterMeanNDVI =
    currentWaterPixels > 0
        ? currentWaterNdviSum / currentWaterPixels
        : 0;



// ==================================================
// PROFESSIONAL LAND-COVER CLASSIFICATION
// Applied only inside the detected change mask.
// ==================================================

function clamp01(value) {
    return Math.max(
        0,
        Math.min(
            1,
            Number(value) || 0
        )
    );
}

function classifyLandCover(
    green,
    red,
    nir,
    swir1
) {

    const ndviDen =
        nir + red;

    const ndwiDen =
        green + nir;

    const ndbiDen =
        swir1 + nir;

    if (
        !Number.isFinite(ndviDen) ||
        !Number.isFinite(ndwiDen) ||
        !Number.isFinite(ndbiDen) ||
        ndviDen === 0 ||
        ndwiDen === 0 ||
        ndbiDen === 0
    ) {

        return {
            type: 'other',
            intensity: 0.5
        };

    }

    const ndvi =
        (nir - red) /
        ndviDen;

    const ndwi =
        (green - nir) /
        ndwiDen;

    const ndbi =
        (swir1 - nir) /
        ndbiDen;


    // WATER
    if (
        ndwi > 0.15 &&
        ndvi < 0.25
    ) {

        return {
            type: 'water',

            intensity:
                clamp01(
                    (ndwi - 0.15) /
                    0.45
                )
        };

    }


    // VEGETATION
    if (
        ndvi >= 0.20
    ) {

        return {
            type: 'vegetation',

            intensity:
                clamp01(
                    (ndvi - 0.20) /
                    0.60
                )
        };

    }


    // BUILT-UP CANDIDATE
    if (
        ndbi > 0.05 &&
        ndvi < 0.30
    ) {

        return {
            type: 'built-up',

            intensity:
                clamp01(
                    (ndbi - 0.05) /
                    0.30
                )
        };

    }


    // BARE / EXPOSED SOIL
    if (
        ndvi < 0.20 &&
        ndwi < 0.15
    ) {

        return {
            type: 'bare-soil',

            intensity:
                clamp01(
                    (0.20 - ndvi) /
                    0.40
                )
        };

    }


    return {
        type: 'other',
        intensity: 0.5
    };
}


function buildLandCoverGeometry(
    changedMask,
    raster,
    rasterBbox
) {

    const {
        width,
        height,
        green,
        red,
        nir,
        swir1
    } = raster;

    const labels =
        new Array(
            width * height
        ).fill(null);

    const intensities =
        new Float32Array(
            width * height
        );


    for (
        let i = 0;
        i < width * height;
        i++
    ) {

        if (
            changedMask[i] !== 1
        ) {
            continue;
        }

        const classification =
            classifyLandCover(
                Number(green[i]),
                Number(red[i]),
                Number(nir[i]),
                Number(swir1[i])
            );

        labels[i] =
            classification.type;

        intensities[i] =
            classification.intensity;
    }


    const rectangles = [];
    const active = new Map();


    for (
        let y = 0;
        y < height;
        y++
    ) {

        const runs = [];

        let start = -1;
        let type = null;

        let intensitySum = 0;
        let count = 0;


        const flush = (
            endX
        ) => {

            if (
                start < 0 ||
                !type
            ) {
                return;
            }

            runs.push({

                x1: start,
                x2: endX,

                type,

                intensity:
                    count
                        ? intensitySum / count
                        : 0.5
            });

            start = -1;
            type = null;

            intensitySum = 0;
            count = 0;
        };


        for (
            let x = 0;
            x <= width;
            x++
        ) {

            const i =
                y * width + x;

            const nextType =
                x < width
                    ? labels[i]
                    : null;


            if (
                nextType &&
                (
                    start < 0 ||
                    nextType === type
                )
            ) {

                if (
                    start < 0
                ) {

                    start = x;
                    type = nextType;
                }

                intensitySum +=
                    intensities[i];

                count++;

            }

            else {

                flush(x);

                if (nextType) {

                    start = x;
                    type = nextType;

                    intensitySum =
                        intensities[i];

                    count = 1;
                }
            }
        }


        const currentKeys =
            new Set();


        for (
            const run of runs
        ) {

            const key =
                `${run.x1}:${run.x2}:${run.type}`;

            currentKeys.add(key);

            const existing =
                active.get(key);


            if (existing) {

                existing.y2 =
                    y + 1;

                existing.intensitySum +=
                    run.intensity;

                existing.rowCount++;

            }

            else {

                active.set(
                    key,
                    {

                        x1: run.x1,
                        x2: run.x2,

                        y1: y,
                        y2: y + 1,

                        type:
                            run.type,

                        intensitySum:
                            run.intensity,

                        rowCount: 1
                    }
                );
            }
        }


        for (
            const [
                key,
                rect
            ] of active
        ) {

            if (
                !currentKeys.has(key)
            ) {

                rectangles.push(
                    rect
                );

                active.delete(key);
            }
        }
    }


    for (
        const rect of
        active.values()
    ) {

        rectangles.push(
            rect
        );
    }


    const [
        minLng,
        minLat,
        maxLng,
        maxLat
    ] = rasterBbox;


    const features =
        rectangles.map(
            rect => {

                const lng1 =
                    minLng +
                    (
                        rect.x1 /
                        width
                    ) *
                    (
                        maxLng -
                        minLng
                    );

                const lng2 =
                    minLng +
                    (
                        rect.x2 /
                        width
                    ) *
                    (
                        maxLng -
                        minLng
                    );

                const latTop =
                    maxLat -
                    (
                        rect.y1 /
                        height
                    ) *
                    (
                        maxLat -
                        minLat
                    );

                const latBottom =
                    maxLat -
                    (
                        rect.y2 /
                        height
                    ) *
                    (
                        maxLat -
                        minLat
                    );


            return turf.polygon(

    [
        [
            [
                lng1,
                latTop
            ],
            [
                lng2,
                latTop
            ],
            [
                lng2,
                latBottom
            ],
            [
                lng1,
                latBottom
            ],
            [
                lng1,
                latTop
            ]
        ]
    ],

    {
        landCover:
            rect.type,

        intensity:
            Number(
                clamp01(
                    rect.intensitySum /
                    rect.rowCount
                ).toFixed(3)
            )
    }
);
            }
        );


    return turf.featureCollection(
        features
    );
}


const beforeLandCoverGeometry =
    buildLandCoverGeometry(
        changedPixelMask,
        baseline,
        bbox
    );


const afterLandCoverGeometry =
    buildLandCoverGeometry(
        changedPixelMask,
        current,
        bbox
    );

        


    
return {
        width:
            baseline.width,

        height:
            baseline.height,

        totalPixels,

        validPixels,

        changeThreshold,

        meanBaselineNDVI:
            Number(
                meanBaselineNDVI.toFixed(4)
            ),

        meanCurrentNDVI:
            Number(
                meanCurrentNDVI.toFixed(4)
            ),

        meanDeltaNDVI:
            Number(
                meanDeltaNDVI.toFixed(4)
            ),

        changedPixels,

        changePercentage:
            Number(
                changePercentage.toFixed(2)
            ),

        pixelAreaM2:
            Number(
                pixelAreaM2.toFixed(2)
            ),

       changedAreaM2:
    Number(
        changedAreaM2.toFixed(2)
    ),

// ==================================================
// REAL PIXEL CHANGE GEOMETRY
// ==================================================

changeGeometry,

changeGeometryType:
    'RASTER_PIXEL_RUNS',


    beforeLandCoverGeometry,

afterLandCoverGeometry,

landCoverClassification: {

    method:
        'Sentinel-2 NDVI + NDWI + NDBI',

    classes: [

        'vegetation',
        'built-up',
        'water',
        'bare-soil',
        'other'

    ],

    note:
        'Built-up is a spectral candidate class, not building-level object detection.'
},

        minDeltaNDVI:
            Number(
                minDelta.toFixed(4)
            ),

        maxDeltaNDVI:
            Number(
                maxDelta.toFixed(4)
            ),

        // ==================================================
        // Water Hyacinth
        // ==================================================

     waterHyacinth: {
    detectionType:
        'WATER_VEGETATION_CANDIDATE',

    detected:
        waterHyacinthDetected,

    baselineAreaM2:
        Number(
            baselineHyacinthAreaM2.toFixed(2)
        ),

    currentAreaM2:
        Number(
            currentHyacinthAreaM2.toFixed(2)
        ),

    newAreaM2:
        Number(
            newHyacinthAreaM2.toFixed(2)
        ),

    lostAreaM2:
        Number(
            lostHyacinthAreaM2.toFixed(2)
        ),

    coveragePercentage:
        Number(
            coveragePercentage.toFixed(2)
        ),

    growthPercentage:
        Number(
            growthPercentage.toFixed(2)
        ),

    trend,

    confidence,

    thresholds: {
        ndwi: waterThreshold,
        ndvi: vegetationThreshold
    },

    pixels: {
        baseline: baselineHyacinthPixels,
        current: currentHyacinthPixels,
        new: hyacinthNewPixels,
        lost: hyacinthLostPixels,

        baselineWater: baselineWaterPixels,
        currentWater: currentWaterPixels,

        baselineWaterVegetation:
            baselineWaterVegetationPixels,

        currentWaterVegetation:
            currentWaterVegetationPixels
    },

    waterDiagnostics: {
        currentWaterPixels,

        currentWaterMeanNDVI:
            Number(
                currentWaterMeanNDVI.toFixed(4)
            ),

        currentWaterNdviMin:
            currentWaterPixels > 0
                ? Number(
                    currentWaterNdviMin.toFixed(4)
                )
                : null,

        currentWaterNdviMax:
            currentWaterPixels > 0
                ? Number(
                    currentWaterNdviMax.toFixed(4)
                )
                : null,

        ndviDistribution: {
            belowZero:
                currentWaterNdviBelowZero,

            zeroTo02:
                currentWaterNdviZeroTo02,

            from02To04:
                currentWaterNdvi02To04,

            above04:
                currentWaterNdviAbove04
        },

        spatialClustering: {
            clusterCount,

            largestClusterPixels,

            clusteredCandidatePixels,

            largestClusterPercentage:
                currentWaterVegetationPixels > 0
                    ? Number(
                        (
                            largestClusterPixels /
                            currentWaterVegetationPixels *
                            100
                        ).toFixed(2)
                    )
                    : 0,

            clusterSizes
        }
    },

           rawNdwi: {
        mean:
            validPixels > 0
                ? Number(
                    (
                        currentNdwiSum /
                        validPixels
                    ).toFixed(4)
                )
                : 0,

        min:
            validPixels > 0
                ? Number(
                    currentNdwiMin.toFixed(4)
                )
                : null,

        max:
            validPixels > 0
                ? Number(
                    currentNdwiMax.toFixed(4)
                )
                : null,

        distribution: {
            belowMinus02:
                currentNdwiBelowMinus02,

            minus02To0:
                currentNdwiMinus02To0,

            zeroTo02:
                currentNdwiZeroTo02,

            above02:
                currentNdwiAbove02
        }
    }
    }
};
}

// ======================================================
// IRRIGATION AI
// ======================================================
// IRRIGATION AI
// Dedicated Application Server
// ======================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();



app.use(
    express.json({
        limit: '50mb'
    })
);
// ==================================================
// 🧠 AI FEEDBACK
// ==================================================

app.post('/api/ai/feedback', async (req, res) => {
    try {
        const {
            caseId,
            action,
            outcome,
            previousData = {}
        } = req.body;

        if (!caseId || !action || !outcome) {
            return res.status(400).json({
                success: false,
                error: 'caseId, action and outcome are required'
            });
        }

        const nextData = {
            ...previousData,
            caseId,
            decisionOutcome: outcome
        };

        const result = await irrigationAILearn({
            previousData: {
                ...previousData,
                caseId
            },
            action,
            nextData,
            done: true
        });

        console.log('');
        console.log('🧠 AI FEEDBACK RECEIVED');
        console.log('Case:', caseId);
        console.log('Action:', action);
        console.log('Outcome:', outcome);
        console.log('Reward:', result.reward);
        console.log('==========================================');

        res.json({
            success: true,
            caseId,
            action,
            outcome,
            reward: result.reward
        });

    } catch (error) {
        console.error('❌ AI feedback failed:', error);

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

const PORT = 3100;



// ======================================================
// Irrigation AI Agent
// ======================================================

await initializeIrrigationAI();

console.log('🧠 Irrigation AI Agent initialized');


// ======================================================
// Real Drain GIS Data
// ======================================================

const REAL_DRAINS_FILE = path.join(
    __dirname,
    'data',
    'real_drains_west_sidi_salem_fouh.geojson'
);

function loadRealDrains() {
    if (!fs.existsSync(REAL_DRAINS_FILE)) {
        throw new Error(
            `Real drains file not found: ${REAL_DRAINS_FILE}`
        );
    }

    return JSON.parse(
        fs.readFileSync(
            REAL_DRAINS_FILE,
            'utf8'
        )
    );
}
// ======================================================
// Get Real Drains
// ======================================================

app.get('/api/drains', (req, res) => {

    try {

        const data = loadRealDrains();

        // ==========================================
        // استخراج المصارف الحقيقية
        // ==========================================

        const drainFeatures =
            data.features.filter(
                feature =>
                    feature.geometry?.type === 'LineString' &&
                    feature.properties?.featureType === 'drain'
            );

        // ==========================================
        // تحويل المصارف
        // ==========================================

        const drains =
            drainFeatures.map(
                (feature, index) => {

                    const properties =
                        feature.properties || {};

                    // ======================================
                    // ID الحقيقي للمصرف
                    // ======================================

                    const drainId =
                        properties.drain_id ||
                        properties.drainId ||
                        `DR-${String(index + 1).padStart(3, '0')}`;

                    // ======================================
                    // اسم المصرف
                    // ======================================

                    const drainName =
                        properties.drain_name ||
                        properties.name ||
                        `مصرف ${index + 1}`;

                    // ======================================
                    // البحث عن أملاك المصرف
                    // ======================================

                    const propertyFeatures =
                        data.features.filter(
                            propertyFeature => {

                                const propertyProperties =
                                    propertyFeature.properties || {};

                                const propertyDrainId =
                                    propertyProperties.drain_id ||
                                    propertyProperties.drainId;

                                return (

                                    propertyProperties.featureType ===
                                        'drain_property_area'

                                    &&

                                    String(propertyDrainId) ===
                                        String(drainId)

                                    &&

                                    propertyFeature.geometry

                                );

                            }
                        );

                    // ======================================
                    // تجهيز Geometry الأملاك
                    // ======================================

          // ======================================
// تجهيز Geometry الأملاك
// ======================================

// نفك MultiPolygon إلى Polygons منفصلة
// حتى تظهر كل قطعة أرض كقطعة مستقلة على الخريطة

const propertyAreas = [];

propertyFeatures.forEach(
    propertyFeature => {

        const propertyProperties =
            propertyFeature.properties || {};

        const geometry =
            propertyFeature.geometry;

        if (!geometry) {
            return;
        }

        // ======================================
        // Polygon
        // ======================================

        if (
            geometry.type ===
            'Polygon'
        ) {

            propertyAreas.push({

                type:
                    'Feature',

                properties: {

                    drainId:
                        drainId,

                    drainName:
                        drainName,

                    propertyCount:
                        propertyProperties.property_count ||
                        propertyProperties.propertyCount ||
                        1,

                    propertyAreaM2:
                        propertyProperties.property_area_m2 ||
                        propertyProperties.propertyAreaM2 ||
                        0

                },

                geometry: {

                    type:
                        'Polygon',

                    coordinates:
                        geometry.coordinates

                }

            });

        }

        // ======================================
        // MultiPolygon
        // ======================================

        else if (
            geometry.type ===
            'MultiPolygon'
        ) {

            geometry.coordinates.forEach(
                polygonCoordinates => {

                    propertyAreas.push({

                        type:
                            'Feature',

                        properties: {

                            drainId:
                                drainId,

                            drainName:
                                drainName,

                            propertyCount:
                                1,

                            propertyAreaM2:
                                propertyProperties.property_area_m2 ||
                                propertyProperties.propertyAreaM2 ||
                                0

                        },

                        geometry: {

                            type:
                                'Polygon',

                            coordinates:
                                polygonCoordinates

                        }

                    });

                }
            );

        }

    }
);
                    // ======================================
                    // بيانات المصرف النهائية
                    // ======================================

                    return {

                        id:
                            drainId,

                        name:
                            drainName,

                        lengthM:
                            properties.length_m ||
                            properties.lengthM ||
                            0,

                        lengthKm:
                            properties.length_km ||
                            properties.lengthKm ||
                            0,

                        pointCount:
                            properties.point_count ||
                            properties.pointCount ||
                            0,

                        // ==================================
                        // Geometry المصرف
                        // ==================================

                        geometry:
                            feature.geometry,

                        // ==================================
                        // أملاك المصرف الحقيقية
                        // ==================================

                        propertyCount:
                            propertyAreas.length,

                        propertyGeometry:
                            propertyAreas

                    };

                }
            );

        // ==========================================
        // إرسال البيانات
        // ==========================================

        res.json({

            success:
                true,

            count:
                drains.length,

            drains

        });

    } catch (error) {

        console.error(
            'Real drains error:',
            error
        );

        res.status(500).json({

            success:
                false,

            error:
                error.message

        });

    }

});

// ======================================================
// Paths
// ======================================================

const PUBLIC_DIR = path.join(__dirname, 'public');

const CASES_FILE = path.join(
    __dirname,
    'engineering_cases.json'
);

// ======================================================
// Middleware
// ======================================================

app.use(express.json());

app.use(express.static(PUBLIC_DIR));

// ======================================================
// Helpers
// ======================================================

function readCases() {

    if (!fs.existsSync(CASES_FILE)) {
        return [];
    }

    try {

        const content = fs.readFileSync(
            CASES_FILE,
            'utf8'
        );

        if (!content.trim()) {
            return [];
        }

        const cases = JSON.parse(content);

        return Array.isArray(cases)
            ? cases
            : [];

    } catch (error) {

        console.error(
            '❌ Error reading engineering_cases.json:',
            error.message
        );

        return [];
    }
}


// ======================================================
// حفظ الحالات
// ======================================================

function saveCases(cases) {

    fs.writeFileSync(
        CASES_FILE,
        JSON.stringify(cases, null, 2),
        'utf8'
    );
}


// ======================================================
// إنشاء Case ID تلقائي
// IRR-2026-0001
// ======================================================

function generateCaseId(cases) {

    const year = new Date()
        .getFullYear();

    let maxNumber = 0;

    for (const item of cases) {

        if (!item.caseId) {
            continue;
        }

        const match =
            item.caseId.match(
                /^IRR-\d{4}-(\d+)$/
            );

        if (match) {

            const number =
                Number(match[1]);

            if (number > maxNumber) {
                maxNumber = number;
            }
        }
    }

    const nextNumber =
        maxNumber + 1;

    return `IRR-${year}-${String(nextNumber).padStart(4, '0')}`;
}


// ======================================================
// API: جميع الحالات
// ======================================================

app.get(
    '/api/cases',
    (req, res) => {

        const cases =
            readCases();

        res.json({

            success: true,

            count: cases.length,

            cases

        });

    }
);


// ======================================================
// API: حالة محددة
// ======================================================

app.get(
    '/api/cases/:caseId',
    (req, res) => {

        const cases =
            readCases();

        const item =
            cases.find(
                c =>
                    c.caseId ===
                    req.params.caseId
            );

        if (!item) {

            return res.status(404).json({

                success: false,

                message:
                    'Case not found'

            });

        }

        res.json({

            success: true,

            case: item

        });

    }
);


// ======================================================
// API: إحصائيات الحالات
// ======================================================

app.get(
    '/api/stats',
    (req, res) => {

        const cases =
            readCases();

        const total =
            cases.length;


        const highRisk =
            cases.filter(
                c =>
                    Number(
                        c.ai?.riskScore || 0
                    ) >= 85
            ).length;


        const fieldInspection =
            cases.filter(
                c =>
                    c.decision?.action ===
                    'field_inspection'
            ).length;


        const verify =
            cases.filter(
                c =>
                    c.decision?.action ===
                    'verify'
            ).length;


        const monitor =
            cases.filter(
                c =>
                    c.decision?.action ===
                    'monitor'
            ).length;


        const urgent =
            cases.filter(
                c =>
                    c.decision?.action ===
                    'urgent_intervention'
            ).length;


        const confidenceValues =
            cases
                .map(
                    c =>
                        Number(
                            c.ai?.confidence || 0
                        )
                )
                .filter(
                    n =>
                        !Number.isNaN(n)
                );


        const averageConfidence =
            confidenceValues.length
                ? Math.round(
                    confidenceValues.reduce(
                        (a, b) => a + b,
                        0
                    )
                    /
                    confidenceValues.length
                )
                : 0;


        res.json({

            success: true,

            stats: {

                total,

                highRisk,

                fieldInspection,

                verify,

                monitor,

                urgent,

                averageConfidence

            }

        });

    }
);



// ======================================================
// API: البحث عن صور Sentinel-2
//
// GET /api/satellite/search
//
// الهدف:
// Backend → Copernicus Catalog → Sentinel-2 L2A
//
// لا يتم تحميل أي صورة هنا.
// نحن فقط نبحث عن المنتجات المتاحة.
// ======================================================

app.get(
    '/api/satellite/search',
    async (req, res) => {

        try {

            console.log('');

            console.log(
                '=========================================='
            );

            console.log(
                '🛰️ COPERNICUS SATELLITE SEARCH'
            );

            console.log(
                '=========================================='
            );


            // ==================================================
            // 1. إحداثيات الحالة
            // ==================================================

    const lat =
    Number(req.query?.lat);

const lng =
    Number(req.query?.lng);

const requestedAOI =
    req.query?.aoi || null;


const hasValidAOI =
    requestedAOI &&
    Number.isFinite(Number(requestedAOI.minLat)) &&
    Number.isFinite(Number(requestedAOI.maxLat)) &&
    Number.isFinite(Number(requestedAOI.minLng)) &&
    Number.isFinite(Number(requestedAOI.maxLng));

if (
    !hasValidAOI &&
    (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
    )
) {

    return res.status(400).json({
        success: false,
        message:
            'Valid lat/lng or a valid AOI is required.'
    });

}
            // ==================================================
            // 2. إنشاء AOI صغيرة حول الحالة
            //
            // حوالي 1 كم × 1 كم
            // ==================================================

            const delta =
                0.005;


            const bbox = [

                lng - delta,

                lat - delta,

                lng + delta,

                lat + delta

            ];


            console.log(
                '📍 AOI:',
                {
                    lat,
                    lng,
                    bbox
                }
            );


            // ==================================================
            // 3. الفترة الزمنية
            //
            // يمكن تغييرها من URL
            //
            // مثال:
            // ?start=2026-07-01&end=2026-08-01
            // ==================================================

            const start =
                req.query.start ||
                '2026-07-01';

            const end =
                req.query.end ||
                '2026-08-01';


            const datetime =
                `${start}T00:00:00Z/${end}T23:59:59Z`;


            // ==================================================
            // 4. Cloud Coverage
            // ==================================================

            const maxCloud =
                Number(
                    req.query.cloud || 30
                );


            // ==================================================
            // 5. الحصول على Access Token
            // ==================================================

            const token =
                await getCopernicusAccessToken();


            console.log(
                '🔐 Copernicus authentication: SUCCESS'
            );


            // ==================================================
            // 6. البحث في Catalog API
            // ==================================================

            const catalogResponse =
                await fetch(
                    'https://sh.dataspace.copernicus.eu/catalog/v1/search',
                    {

                        method: 'POST',

                        headers: {

                            'Authorization':
                                `Bearer ${token}`,

                            'Content-Type':
                                'application/json'

                        },

                        body:
                            JSON.stringify({

                                bbox,

                                datetime,

                                collections: [
                                    'sentinel-2-l2a'
                                ],

                                limit: 10,

                                filter:
                                    `eo:cloud_cover <= ${maxCloud}`,

                                'filter-lang':
                                    'cql2-text'

                            })

                    }
                );


            // ==================================================
            // 7. التحقق من نتيجة Copernicus
            // ==================================================

            if (!catalogResponse.ok) {

                const errorText =
                    await catalogResponse.text();

                console.error(
                    '❌ Copernicus Catalog error:',
                    catalogResponse.status,
                    errorText
                );

                return res.status(
                    catalogResponse.status
                ).json({

                    success: false,

                    message:
                        'Copernicus Catalog search failed.',

                    status:
                        catalogResponse.status

                });

            }


            const catalogData =
                await catalogResponse.json();


            const features =
                Array.isArray(
                    catalogData.features
                )
                    ? catalogData.features
                    : [];


            // ==================================================
            // 8. تجهيز نتيجة مختصرة للـ Dashboard
            // ==================================================

            const results =
                features.map(
                    item => ({

                        id:
                            item.id,

                        date:
                            item.properties?.datetime ||
                            item.properties?.['start_datetime'] ||
                            null,

                        cloudCover:
                            item.properties?.['eo:cloud_cover'] ??
                            null,

                        collection:
                            item.collection ||
                            'sentinel-2-l2a',

                        bbox:
                            item.bbox ||
                            null

                    })
                );


            console.log(
                `🛰️ Copernicus results: ${results.length}`
            );


            for (
                const item of results
            ) {

                console.log(
                    '📡',
                    {
                        date:
                            item.date,

                        cloud:
                            item.cloudCover,

                        id:
                            item.id
                    }
                );

            }


            console.log(
                '=========================================='
            );

            console.log('');


            // ==================================================
            // 9. Response
            // ==================================================

            return res.json({

                success: true,

                source:
                    'Copernicus Data Space',

                collection:
                    'sentinel-2-l2a',

                search: {

                    latitude:
                        lat,

                    longitude:
                        lng,

                    bbox,

                    datetime,

                    maxCloud

                },

                count:
                    results.length,

                results

            });

        }


        catch (error) {

            console.error(
                '❌ Copernicus Satellite Search Error:',
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    'Copernicus satellite search failed.',

                error:
                    error.message

            });

        }

    }
);



// ======================================================
// API: معالجة AOI من Sentinel-2
//
// POST /api/satellite/process
//
// الهدف:
// Copernicus → معالجة AOI صغيرة → صورة فقط
//
// لا يتم تحميل Sentinel-2 tile كامل.
// ======================================================

app.post(
    '/api/satellite/process',
    async (req, res) => {

        try {

            console.log('');

            console.log(
                '=========================================='
            );

            console.log(
                '🛰️ COPERNICUS AOI PROCESSING'
            );

            console.log(
                '=========================================='
            );


            // ==================================================
            // 1. قراءة الإحداثيات
            // ==================================================

            const lat =
                Number(
                    req.body?.lat
                );

            const lng =
                Number(
                    req.body?.lng
                );


            if (
                !Number.isFinite(lat) ||
                !Number.isFinite(lng)
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        'Valid lat and lng are required.'

                });

            }




            

            // ==================================================
            // 2. التاريخ
            // ==================================================

            const date =
                req.body?.date ||
                '2026-07-31';


            // ==================================================
            // 3. AOI صغيرة
            //
            // نفس الـ AOI المستخدمة في البحث
            // حوالي 1 كم × 1 كم
            // ==================================================

            const delta =
                0.005;


            const bbox = [

                lng - delta,

                lat - delta,

                lng + delta,

                lat + delta

            ];


            console.log(
                '📍 Processing AOI:',
                {
                    lat,
                    lng,
                    bbox,
                    date
                }
            );


            // ==================================================
            // 4. الحصول على Copernicus Access Token
            // ==================================================

            const token =
                await getCopernicusAccessToken();


            console.log(
                '🔐 Copernicus authentication: SUCCESS'
            );


            // ==================================================
            // 5. Evalscript
            //
            // نطلب RGB فقط:
            //
            // B04 = Red
            // B03 = Green
            // B02 = Blue
            //
            // Sentinel-2 L2A
            // ==================================================

            const evalscript = `
//VERSION=3

function setup() {

    return {

        input: [
            "B02",
            "B03",
            "B04"
        ],

        output: {
            bands: 3
        }

    };

}

function evaluatePixel(sample) {

    return [

        2.5 * sample.B04,

        2.5 * sample.B03,

        2.5 * sample.B02

    ];

}
`;


            // ==================================================
            // 6. تجهيز Processing Request
            // ==================================================

            const processingRequest = {

                input: {

          bounds: {

    properties: {
        crs:
            'http://www.opengis.net/def/crs/OGC/1.3/CRS84'
    },

    bbox
},


                data: [

    {

        type:
            'sentinel-2-l2a',

        dataFilter: {

            timeRange: {

                from:
                    `${date}T00:00:00Z`,

                to:
                    `${date}T23:59:59Z`

            },

            mosaickingOrder:
                'leastCC'

        },

        processing: {

            upsampling:
                'BICUBIC',

            downsampling:
                'BICUBIC'

        }

    }

]

},

output: {

    width:
        isPointAnalysis
            ? 1536
            : 512,

    height:
        isPointAnalysis
            ? 1536
            : 512,

    responses: [

        {

            identifier:
                'default',

            format: {

                type:
                    'image/png'

            }

        }

    ]

},

evalscript

};
            // ==================================================
            // 7. إرسال الطلب إلى Copernicus Processing API
            // ==================================================

            const processingResponse =
                await fetch(
                    'https://sh.dataspace.copernicus.eu/process/v1',
                    {

                        method: 'POST',

                        headers: {

                            'Authorization':
                                `Bearer ${token}`,

                            'Content-Type':
                                'application/json',

                            'Accept':
                                'image/png'

                        },

                        body:
                            JSON.stringify(
                                processingRequest
                            )

                    }
                );


            // ==================================================
            // 8. التحقق من الاستجابة
            // ==================================================

            if (
                !processingResponse.ok
            ) {

                const errorText =
                    await processingResponse.text();


                console.error(
                    '❌ Copernicus Processing error:',
                    processingResponse.status,
                    errorText
                );


                return res.status(
                    processingResponse.status
                ).json({

                    success: false,

                    message:
                        'Copernicus Processing API failed.',

                    status:
                        processingResponse.status,

                    details:
                        errorText

                });

            }


            // ==================================================
            // 9. تحويل الصورة إلى Base64
            //
            // للاختبار فقط.
            // ==================================================

            const imageBuffer =
                Buffer.from(
                    await processingResponse.arrayBuffer()
                );


         console.log(
    '🖼️ AOI image received'
);




            console.log(
                `📦 Image size: ${imageBuffer.length} bytes`
            );

            const satelliteDir =
    path.join(
        PUBLIC_DIR,
        'satellite'
    );

if (
    !fs.existsSync(
        satelliteDir
    )
) {
    fs.mkdirSync(
        satelliteDir,
        {
            recursive: true
        }
    );
}

const safeDate =
    String(date).replace(
        /[^0-9-]/g,
        ''
    );

const fileName =
    `aoi_${lat}_${lng}_${safeDate}.png`;

const filePath =
    path.join(
        satelliteDir,
        fileName
    );

fs.writeFileSync(
    filePath,
    imageBuffer
);

console.log(
    '💾 Satellite image saved:',
    filePath
);


            console.log(
                '=========================================='
            );

            console.log('');


            // ==================================================
            // 10. Response
            // ==================================================

            return res.json({

                success: true,

                source:
                    'Copernicus Data Space',

                collection:
                    'sentinel-2-l2a',

                processing: {

                    latitude:
                        lat,

                    longitude:
                        lng,

                    date,

                    bbox,

                    width:
                        1024,

                    height:
                        1024,

                    format:
                        'image/png'

                },

            image: {
    mimeType:
        'image/png',

    sizeBytes:
        imageBuffer.length,

    fileName,

    url:
        `/satellite/${fileName}`
}
            });

        }


        catch (error) {

            console.error(
                '❌ Copernicus AOI Processing Error:',
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    'Copernicus AOI processing failed.',

                error:
                    error.message

            });

        }

    }
);


async function findBestSatelliteDate(
    token,
    bbox,
    targetDate,
    direction = 'nearest',
    afterDate = null
) {
    const target =
        new Date(`${targetDate}T23:59:59Z`);

    const days = 45;

    const startDate =
        new Date(
            target.getTime() -
            days * 24 * 60 * 60 * 1000
        );

    const endDate =
        new Date(
            target.getTime() +
            days * 24 * 60 * 60 * 1000
        );

    const datetime =
        `${startDate.toISOString()}/${endDate.toISOString()}`;

    let response;

    for (let attempt = 1; attempt <= 3; attempt++) {

        try {

            console.log(
                `🛰️ Catalog request attempt ${attempt}/3...`
            );

            const controller =
                new AbortController();

            const timeout =
                setTimeout(
                    () => controller.abort(),
                    30000
                );

            try {

                response =
                    await fetch(
                        'https://sh.dataspace.copernicus.eu/catalog/v1/search',
                        {
                            method: 'POST',

                            headers: {
                                'Authorization':
                                    `Bearer ${token}`,

                                'Content-Type':
                                    'application/json'
                            },

                            body:
                                JSON.stringify({

                                    bbox,

                                    datetime,

                                    collections: [
                                        'sentinel-2-l2a'
                                    ],

                                    limit: 100,

                                    filter:
                                        'eo:cloud_cover <= 30',

                                    'filter-lang':
                                        'cql2-text'
                                }),

                            signal:
                                controller.signal
                        }
                    );

            } finally {

                clearTimeout(timeout);

            }

            break;

        } catch (error) {

            console.error(
                `❌ Catalog attempt ${attempt} failed:`,
                error.code ||
                error.name ||
                error.message
            );

            if (attempt === 3) {
                throw error;
            }

            const wait =
                attempt * 2000;

            await new Promise(
                resolve =>
                    setTimeout(
                        resolve,
                        wait
                    )
            );
        }
    }

    if (!response.ok) {

        const errorText =
            await response.text();

        throw new Error(
            `Satellite catalog search failed: ${response.status} ${errorText}`
        );
    }

    const data =
        await response.json();

    const features =
        Array.isArray(data.features)
            ? data.features
            : [];

    if (!features.length) {

        throw new Error(
            `No Sentinel-2 images found around ${targetDate}`
        );
    }

    const candidates =
        features
            .map(item => ({
                id: item.id,

                date:
                    item.properties?.datetime ||
                    item.properties?.start_datetime ||
                    null,

                cloudCover:
                    Number(
                        item.properties?.[
                            'eo:cloud_cover'
                        ]
                    )
            }))
            .filter(item =>
                item.date &&
                Number.isFinite(item.cloudCover)
            );

    if (!candidates.length) {

        throw new Error(
            'No valid Sentinel-2 catalog candidates found.'
        );
    }

    const referenceDate =
    afterDate
        ? new Date(`${afterDate}T23:59:59.999Z`)
        : null;

    let validCandidates;

    // ==================================================
    // FIRST ANALYSIS
    // latest image <= targetDate
    // ==================================================

    if (direction === 'before') {

        validCandidates =
            candidates.filter(item => {

                const itemDate =
                    new Date(item.date);

                return itemDate <= target;

            });

        validCandidates.sort(
            (a, b) => {

                const dateA =
                    new Date(a.date).getTime();

                const dateB =
                    new Date(b.date).getTime();

                // أحدث صورة أولاً
                if (dateA !== dateB) {
                    return dateB - dateA;
                }

                // لو نفس التاريخ، الأقل سحباً
                return (
                    Number(a.cloudCover) -
                    Number(b.cloudCover)
                );

            }
        );

    }

    // ==================================================
    // NEXT ANALYSIS
    // latest image > previous current
    // AND <= targetDate
    // ==================================================

    else if (
        direction === 'after' &&
        referenceDate
    ) {

        validCandidates =
            candidates.filter(item => {

                const itemDate =
                    new Date(item.date);

                return (
                    itemDate > referenceDate &&
                    itemDate <= target
                );

            });

        validCandidates.sort(
            (a, b) => {

                const dateA =
                    new Date(a.date).getTime();

                const dateB =
                    new Date(b.date).getTime();

                // أهم حاجة: أحدث صورة بعد التحليل السابق
                if (dateA !== dateB) {
                    return dateB - dateA;
                }

                // لو نفس التاريخ، الأقل سحباً
                return (
                    Number(a.cloudCover) -
                    Number(b.cloudCover)
                );

            }
        );

    }

    else {

const validCandidates =
    candidates.filter(item => {

        const itemDate =
            new Date(item.date);

        // ==========================================
        // BEFORE
        // الصورة تكون في أو قبل التاريخ المطلوب
        // ==========================================

        if (direction === 'before') {

            return (
                itemDate <= target
            );

        }


        // ==========================================
        // AFTER
        // الصورة لازم تكون بعد آخر تحليل
        // وحتى التاريخ الحالي
        // ==========================================

        if (direction === 'after') {

            if (!afterDate) {

                return (
                    itemDate > target
                );

            }

            const lowerBound =
                new Date(
                    `${afterDate}T23:59:59Z`
                );

            return (
                itemDate > lowerBound &&
                itemDate <= target
            );

        }


        // ==========================================
        // NEAREST
        // ==========================================

        return true;

    });

       validCandidates.sort(
    (a, b) => {

        const dateA =
            new Date(a.date).getTime();

        const dateB =
            new Date(b.date).getTime();

        // ==========================================
        // في التحليل الجديد:
        // نريد أحدث صورة بعد آخر تحليل
        // ==========================================

        if (direction === 'after') {

            if (dateA !== dateB) {
                return dateB - dateA;
            }

            return (
                Number(a.cloudCover) -
                Number(b.cloudCover)
            );
        }


        // ==========================================
        // BEFORE / NEAREST
        // ==========================================

        const distanceA =
            Math.abs(
                dateA -
                target.getTime()
            );

        const distanceB =
            Math.abs(
                dateB -
                target.getTime()
            );

        const cloudA =
            Number(a.cloudCover);

        const cloudB =
            Number(b.cloudCover);

        const MAX_REASONABLE_CLOUD =
            20;

        const aGood =
            cloudA <= MAX_REASONABLE_CLOUD;

        const bGood =
            cloudB <= MAX_REASONABLE_CLOUD;

        if (aGood !== bGood) {
            return aGood ? -1 : 1;
        }

        if (distanceA !== distanceB) {
            return distanceA - distanceB;
        }

        return cloudA - cloudB;

    }
);
    }

    if (!validCandidates.length) {

        if (
            direction === 'after' &&
            afterDate
        ) {

            throw new Error(
                `NO_NEW_SATELLITE_IMAGE: No Sentinel-2 image newer than ${afterDate} and up to ${targetDate}.`
            );

        }

        throw new Error(
            `No Sentinel-2 images found for direction "${direction}" around ${targetDate}`
        );
    }

    const best =
        validCandidates[0];

        if (
            direction === 'after' &&
            afterDate &&
            best.date.slice(0, 10) <= afterDate
        ) {
            throw new Error(
                `INVALID_NEW_SATELLITE_IMAGE: Selected ${best.date.slice(0, 10)} is not newer than ${afterDate}`
            );
        }

    console.log(
        '🛰️ Selected Sentinel-2 image:',
        {
            targetDate,
            direction,
            afterDate,
            date: best.date,
            cloudCover: best.cloudCover,
            id: best.id
        }
    );

    return {

        date:
            best.date.slice(0, 10),

        cloudCover:
            best.cloudCover,

        productId:
            best.id

    };
}

// ======================================================
// API: Satellite Change Detection
//
// POST /api/satellite/compare
//
// IMPORTANT:
// - Real drain AOI is REQUIRED
// - No demo drains
// - No fallback point AOI
// - Sentinel-2 baseline/current are selected
//   using the REAL selected drain AOI
// ======================================================

app.post(
    '/api/satellite/compare',
    async (req, res) => {

        try {

            console.log('');
            console.log(
                '=========================================='
            );

            console.log(
                '🛰️ REAL DRAIN SATELLITE CHANGE DETECTION'
            );

            console.log(
                '=========================================='
            );


            // ==================================================
            // 1️⃣ قراءة AOI الحقيقي المرسل من Frontend
            // ==================================================

            const requestedAOI =
                req.body?.aoi || null;


            console.log(
                '🎯 REQUESTED REAL DRAIN AOI:',
                requestedAOI
            );


            // ==================================================
            // 2️⃣ التحقق من وجود AOI
            // ==================================================

            if (!requestedAOI) {

                return res.status(400).json({

                    success: false,

                    message:
                        'Real drain AOI is required for satellite analysis.',

                    code:
                        'REAL_DRAIN_AOI_REQUIRED'

                });

            }


           // ==================================================
// 3️⃣ تحديد نوع تحليل الأقمار الصناعية
// ==================================================

const analysisPoint =
    requestedAOI.analysisPoint || null;

const isPointAnalysis =
    requestedAOI.basedOn === 'drain-location' &&
    analysisPoint &&
    Number.isFinite(
        Number(analysisPoint.lat)
    ) &&
    Number.isFinite(
        Number(analysisPoint.lng)
    );


// ==================================================
// 4️⃣ متغيرات حدود AOI
// ==================================================

let minLat =
    Number(
        requestedAOI.minLat
    );

let maxLat =
    Number(
        requestedAOI.maxLat
    );

let minLng =
    Number(
        requestedAOI.minLng
    );

let maxLng =
    Number(
        requestedAOI.maxLng
    );

let bbox;

let bufferGeometry;


// ==================================================
// 5️⃣ تحليل نقطة محددة على المصرف
// ==================================================

if (
    isPointAnalysis
) {

    const pointLat =
        Number(
            analysisPoint.lat
        );

    const pointLng =
        Number(
            analysisPoint.lng
        );

    const bufferMeters =
        Number(
            requestedAOI.bufferMeters || 50
        );


    if (
        !Number.isFinite(
            pointLat
        ) ||
        !Number.isFinite(
            pointLng
        )
    ) {

        throw new Error(
            'Invalid satellite analysis point coordinates.'
        );

    }


    if (
        !Number.isFinite(
            bufferMeters
        ) ||
        bufferMeters <= 0
    ) {

        throw new Error(
            'Invalid satellite analysis buffer.'
        );

    }


    console.log(
        '📍 POINT SATELLITE AOI:',
        {

            drainId:
                requestedAOI.drainId ||
                null,

            lat:
                pointLat,

            lng:
                pointLng,

            chainageKm:
                requestedAOI.chainageKm ??
                null,

            bufferMeters

        }
    );


    // ==============================================
    // إنشاء نقطة GeoJSON
    // ==============================================

    const analysisPointFeature =
        turf.point([
            pointLng,
            pointLat
        ]);


    // ==============================================
    // إنشاء Buffer حول النقطة
    // ==============================================

    const bufferedPoint =
        turf.buffer(
            analysisPointFeature,
            bufferMeters,
            {
                units:
                    'meters'
            }
        );


    if (
        !bufferedPoint ||
        !bufferedPoint.geometry
    ) {

        throw new Error(
            'Failed to create point satellite AOI buffer.'
        );

    }


    bufferGeometry =
        bufferedPoint.geometry;


    // ==============================================
    // BBOX للـ Buffer
    // ==============================================

    bbox =
        turf.bbox(
            bufferedPoint
        );


    // ==============================================
    // حدود AOI الجديدة
    // ==============================================

    minLng =
        bbox[0];

    minLat =
        bbox[1];

    maxLng =
        bbox[2];

    maxLat =
        bbox[3];


    console.log(
        '🛰️ POINT AOI + BUFFER:',
        {

            bbox,

            minLat,

            maxLat,

            minLng,

            maxLng

        }
    );

}


// ==================================================
// 6️⃣ تحليل المصرف بالكامل - النظام القديم
// ==================================================


else {

    const hasValidAOI =
        Number.isFinite(
            minLat
        ) &&
        Number.isFinite(
            maxLat
        ) &&
        Number.isFinite(
            minLng
        ) &&
        Number.isFinite(
            maxLng
        ) &&

        minLat < maxLat &&
        minLng < maxLng;


    if (
        !hasValidAOI
    ) {

        return res.status(400).json({

            success:
                false,

            message:
                'Invalid real drain AOI boundaries.',

            code:
                'INVALID_DRAIN_AOI',

            aoi:
                requestedAOI

        });

    }


    const aoiWidth =
        maxLng -
        minLng;

    const aoiHeight =
        maxLat -
        minLat;


    if (
        aoiWidth <= 0 ||
        aoiHeight <= 0
    ) {

        return res.status(400).json({

            success:
                false,

            message:
                'Real drain AOI has zero or invalid area.',

            code:
                'EMPTY_DRAIN_AOI'

        });

    }


   // ==============================================
// Geometry المصرف القديمة
// ==============================================

const aoiGeometry =
    requestedAOI.geometry;


if (
    !aoiGeometry
) {

    throw new Error(
        'Real drain property AOI geometry is required.'
    );

}


let aoiFeatureCollection;


if (
    aoiGeometry.type ===
    'FeatureCollection'
) {

    aoiFeatureCollection =
        aoiGeometry;

}

else if (
    aoiGeometry.type ===
    'Feature'
) {

    aoiFeatureCollection =
        turf.featureCollection([
            aoiGeometry
        ]);

}

else if (
    aoiGeometry.type ===
    'Polygon' ||
    aoiGeometry.type ===
    'MultiPolygon'
) {

    aoiFeatureCollection =
        turf.featureCollection([

            turf.feature(
                aoiGeometry
            )

        ]);

}

else {

    throw new Error(
        `Unsupported AOI geometry type: ${aoiGeometry.type}`
    );

}


if (
    !Array.isArray(
        aoiFeatureCollection.features
    ) ||
    aoiFeatureCollection.features.length === 0
) {

    throw new Error(
        'Real drain property AOI contains no property polygons.'
    );

}


bbox =
    turf.bbox(
        aoiFeatureCollection
    );


let bufferFeature;


if (
    aoiFeatureCollection.features.length === 1
) {

    bufferFeature =
        aoiFeatureCollection.features[0];

}

else {

    bufferFeature =
        turf.union(
            aoiFeatureCollection
        );

}


if (
    !bufferFeature ||
    !bufferFeature.geometry
) {

    throw new Error(
        'Failed to build unified drain property AOI.'
    );

}


bufferGeometry =
    bufferFeature.geometry;


console.log(
    '🟢 REAL DRAIN PROPERTY AOI:',
    {

        drainId:
            requestedAOI.drainId ||
            null,

        geometryType:
            bufferGeometry.type,

        propertyFeatures:
            aoiFeatureCollection.features.length,

        bbox

    }
);

}
// ==================================================
// تسجيل AOI النهائي
// ==================================================

console.log(
    '🛰️ REAL PROPERTY AOI + 50m:',
    {

        drainId:
            requestedAOI.drainId ||
            null,

        bufferMeters:
            requestedAOI.bufferMeters ||
            50,

        geometryType:
            bufferGeometry.type,

        propertyFeatures:
            requestedAOI.geometry?.features?.length ||
            0,

        bbox

    }
);
// ==================================================
            // 6️⃣ مركز AOI
            //
            // يستخدم فقط كمرجع جغرافي وحسابات لاحقة
            // وليس لإنشاء AOI جديدة.
            // ==================================================

            const lat =
                (
                    minLat +
                    maxLat
                ) / 2;


            const lng =
                (
                    minLng +
                    maxLng
                ) / 2;


            console.log(
                '🚰 REAL DRAIN AOI CONFIRMED:',
                {

                    drainId:
                        requestedAOI.drainId ||
                        null,

                    name:
                        requestedAOI.name ||
                        null,

                    minLat,

                    maxLat,

                    minLng,

                    maxLng,

                    bbox,

                    center: {
                        lat,
                        lng
                    }

                }
            );


            // ==================================================
            // 7️⃣ قراءة التواريخ المطلوبة
            // ==================================================

            const requestedCurrentDate =
                req.body?.currentDate ||
                null;


            const requestedBaselineDate =
                req.body?.baselineDate ||
                null;


            console.log(
                '📅 Requested satellite dates:',
                {

                    baselineDate:
                        requestedBaselineDate,

                    currentDate:
                        requestedCurrentDate

                }
            );


            // ==================================================
            // 8️⃣ الحصول على Copernicus Access Token
            // ==================================================

            const token =
                await getCopernicusAccessToken();

                


            console.log(
                '🔐 Copernicus authentication: SUCCESS'
            );

// ==================================================
// 9️⃣ تحديد التحليل السابق للمصرف
// ==================================================



// ==================================================
// 9️⃣ تحديد التحليل السابق للمصرف
// ==================================================

// ==================================================
// 9️⃣ تحديد التحليل السابق
//    حسب المصرف + نقطة التحليل
// ==================================================

const currentDrainId =
    String(
        requestedAOI?.drainId ||
        ''
    );


// ==================================================
// معلومات نقطة التحليل الحالية
// ==================================================

const currentChainageKm =
    Number(
        requestedAOI?.chainageKm
    );

const hasCurrentChainage =
    Number.isFinite(
        currentChainageKm
    );


const currentPointLat =
    Number(
        requestedAOI
            ?.analysisPoint
            ?.lat
    );

const currentPointLng =
    Number(
        requestedAOI
            ?.analysisPoint
            ?.lng
    );

const hasCurrentPoint =
    Number.isFinite(
        currentPointLat
    ) &&
    Number.isFinite(
        currentPointLng
    );


// ==================================================
// البحث عن التحليلات السابقة
// ==================================================

const previousCases =
    readCases()
        .filter(item => {

            // ------------------------------------------
            // أولًا: نفس المصرف
            // ------------------------------------------

            const itemDrainId =
                String(
                    item?.drainId ||
                    item?.drain?.id ||
                    item
                        ?.satelliteChangeDetection
                        ?.drainId ||
                    ''
                );


            if (
                itemDrainId !==
                currentDrainId
            ) {

                return false;

            }


            // ==========================================
            // تحليل نقطة محددة
            // ==========================================

            if (
                isPointAnalysis
            ) {

                // --------------------------------------
                // محاولة المطابقة عن طريق Chainage
                // --------------------------------------

                const oldChainageKm =
                    Number(
                        item
                            ?.satelliteChangeDetection
                            ?.chainageKm
                    );


                if (
                    hasCurrentChainage &&
                    Number.isFinite(
                        oldChainageKm
                    )
                ) {

                    const chainageDifference =
                        Math.abs(
                            oldChainageKm -
                            currentChainageKm
                        );


                    // 0.05 km = 50 meters

                    return (
                        chainageDifference <=
                        0.05
                    );

                }


                // --------------------------------------
                // Fallback:
                // لو مفيش chainage محفوظ
                // نقارن بالإحداثيات
                // --------------------------------------

                const oldPoint =
                    item
                        ?.satelliteChangeDetection
                        ?.analysisPoint;


                if (
                    hasCurrentPoint &&
                    oldPoint &&
                    Number.isFinite(
                        Number(
                            oldPoint.lat
                        )
                    ) &&
                    Number.isFinite(
                        Number(
                            oldPoint.lng
                        )
                    )
                ) {

                    const oldPointFeature =
                        turf.point([
                            Number(
                                oldPoint.lng
                            ),

                            Number(
                                oldPoint.lat
                            )
                        ]);


                    const currentPointFeature =
                        turf.point([
                            currentPointLng,
                            currentPointLat
                        ]);


                    const distance =
                        turf.distance(
                            currentPointFeature,
                            oldPointFeature,
                            {
                                units:
                                    'meters'
                            }
                        );


                    return (
                        distance <=
                        50
                    );

                }


                // --------------------------------------
                // مفيش تطابق
                // --------------------------------------

                return false;

            }


            // ==========================================
            // تحليل المصرف بالكامل
            // النظام القديم
            // ==========================================

            return true;

        });

        
previousCases.sort(
    (a, b) => {

        const dateA =
            new Date(
                a?.satelliteChangeDetection
                    ?.currentDate ||
                a?.createdAt ||
                0
            ).getTime();

        const dateB =
            new Date(
                b?.satelliteChangeDetection
                    ?.currentDate ||
                b?.createdAt ||
                0
            ).getTime();

        return dateB - dateA;

    }
);

const lastAnalysisDate =
    previousCases.length > 0
        ? (
            previousCases[0]
                ?.satelliteChangeDetection
                ?.currentDate ||
            null
        )
        : null;

console.log(
    '🛰️ Previous analysis:',
    {
        drainId:
            currentDrainId,

        previousCases:
            previousCases.length,

        lastAnalysisDate
    }
);


// ==================================================
// 🔟 تحديد التاريخ الحالي
// ==================================================

const currentTargetDate =
    requestedCurrentDate ||
    new Date()
        .toISOString()
        .slice(0, 10);

let currentSelection;


// ==================================================
// أول تحليل
// ==================================================

if (!lastAnalysisDate) {

    currentSelection =
        await findBestSatelliteDate(
            token,
            bbox,
            currentTargetDate,
            'before'
        );

}


// ==================================================
// تحليل جديد لنفس المصرف
// ==================================================

else {

    console.log(
        '🔎 Searching for NEW Sentinel-2 image:',
        {
            after:
                lastAnalysisDate,

            until:
                currentTargetDate
        }
    );

    currentSelection =
        await findBestSatelliteDate(
            token,
            bbox,
            currentTargetDate,
            'after',
            lastAnalysisDate
        );

}

const currentDate =
    currentSelection.date;


// ==================================================
// 1️⃣1️⃣ تحديد Baseline
// ==================================================

let baselineTargetDate;

let baselineSource;


// ==========================================
// تحليل جديد
// Baseline = Current السابق
// ==========================================

if (lastAnalysisDate) {

    baselineTargetDate =
        lastAnalysisDate;

    baselineSource =
        'LAST_ANALYSIS';

}


// ==========================================
// أول تحليل
// Baseline = قبل Current بـ 30 يوم
// ==========================================

else {

    baselineTargetDate =
        new Date(
            new Date(
                `${currentDate}T00:00:00Z`
            ).getTime() -
            30 *
            24 *
            60 *
            60 *
            1000
        )
            .toISOString()
            .slice(0, 10);

    baselineSource =
        'INITIAL_30_DAYS';

}


// ==================================================
// Manual baseline override
// ==================================================

if (requestedBaselineDate) {

    baselineTargetDate =
        requestedBaselineDate;

    baselineSource =
        'REQUESTED';

}


// ==================================================
// اختيار Baseline الفعلي
// ==================================================

const baselineSelection =
    await findBestSatelliteDate(
        token,
        bbox,
        baselineTargetDate,
        'before'
    );

const baselineDate =
    baselineSelection.date;


console.log(
    '🛰️ FINAL SATELLITE PAIR:',
    {
        drainId:
            currentDrainId,

        baselineDate,

        currentDate,

        baselineSource,

        lastAnalysisDate,

        baselineProductId:
            baselineSelection.productId,

        currentProductId:
            currentSelection.productId
    }
);
            // ==================================================
            // 1️⃣1️⃣ Sentinel-2 Processing
            // ==================================================

            async function processDate(
                date
            ) {

                console.log(
                    `🛰️ Processing REAL drain AOI for ${date}...`
                );


      const evalscript = `
//VERSION=3

function setup() {

    return {

        input: [
            "B02",
            "B03",
            "B04",
            "B08",
            "B11",
            "SCL"
        ],

        output: {
            bands: 5,
            sampleType: "FLOAT32"
        }

    };

}

function evaluatePixel(sample) {

    const invalid =
        sample.SCL === 3 ||
        sample.SCL === 8 ||
        sample.SCL === 9 ||
        sample.SCL === 10;

    if (invalid) {

        return [
            NaN,
            NaN,
            NaN,
            NaN,
            NaN
        ];

    }

    return [

        sample.B02,
        sample.B03,
        sample.B04,
        sample.B08,
        sample.B11

    ];

}
`;

// ==================================================
// 🎨 TRUE COLOR RGB — BEFORE / AFTER
// B04 = Red
// B03 = Green
// B02 = Blue
// ==================================================

// ==================================================
// 🎨 TRUE COLOR RGB — BEFORE / AFTER
// Sentinel-2 L2A
//
// B04 = Red
// B03 = Green
// B02 = Blue
// ==================================================

const trueColorEvalscript = `
//VERSION=3

function setup() {

    return {

        input: [
            "B02",
            "B03",
            "B04"
        ],

        output: {

            bands: 3,

            sampleType:
                "UINT8"

        }

    };

}

function evaluatePixel(sample) {

    const red =
        Math.max(
            0,
            Math.min(
                255,
                255 *
                Math.pow(
                    2.5 *
                    sample.B04,
                    0.8
                )
            )
        );

    const green =
        Math.max(
            0,
            Math.min(
                255,
                255 *
                Math.pow(
                    2.5 *
                    sample.B03,
                    0.8
                )
            )
        );

    const blue =
        Math.max(
            0,
            Math.min(
                255,
                255 *
                Math.pow(
                    2.5 *
                    sample.B02,
                    0.8
                )
            )
        );

    return [
        red,
        green,
        blue
    ];

}
`;


                const processingRequest = {
                    input: {

                        bounds: {
                            properties: {
                                crs:
                                    'http://www.opengis.net/def/crs/OGC/1.3/CRS84'
                            },
                    
                            bbox,
                    
                            geometry:
                                bufferGeometry
                        },
                    
                        data: [
                            {

                                type:
                                    'sentinel-2-l2a',

                                dataFilter: {

                                    timeRange: {

                                        from:
                                            `${date}T00:00:00Z`,

                                        to:
                                            `${date}T23:59:59Z`

                                    },

                                    mosaickingOrder:
                                        'leastCC'

                                }

                            }

                        ]

                    },


                    output: {

                        width:
                            512,

                        height:
                            512,

                        responses: [

                            {

                                identifier:
                                    'default',

                                format: {

                                    type:
                                        'image/tiff'

                                }

                            }

                        ]

                    },


                    evalscript

                };


                const response =
                    await fetch(

                        'https://sh.dataspace.copernicus.eu/process/v1',

                        {

                            method:
                                'POST',

                            headers: {

                                'Authorization':
                                    `Bearer ${token}`,

                                'Content-Type':
                                    'application/json',

                                'Accept':
                                    'image/tiff'

                            },

                            body:
                                JSON.stringify(
                                    processingRequest
                                )

                        }

                    );


                if (!response.ok) {

                    const errorText =
                        await response.text();


                    throw new Error(

                        `Copernicus Processing failed for ${date}: ${response.status} ${errorText}`

                    );

                }


                const imageBuffer =
                    Buffer.from(
                        await response.arrayBuffer()
                    );




// ==================================================
// 🎨 BBOX خاص بصورة True Color
// التحليل يظل على Buffer 50m
// لكن صورة العرض تكون أكبر حول النقطة
// ==================================================

let trueColorBbox = bbox;

if (
    isPointAnalysis &&
    analysisPoint
) {

    const displayPoint =
        turf.point([
            Number(analysisPoint.lng),
            Number(analysisPoint.lat)
        ]);

   const displayArea =
    turf.buffer(
        displayPoint,
        1000,
        {
            units: 'meters'
        }
    );

    trueColorBbox =
        turf.bbox(displayArea);

        
}




// ==================================================
// 🎨 تحميل صورة True Color لنفس التاريخ ونفس الـAOI
// ==================================================

const trueColorProcessingRequest = {

    input: {

      bounds: {

    properties: {

        crs:
            'http://www.opengis.net/def/crs/OGC/1.3/CRS84'

    },

    bbox:
        trueColorBbox

},
        data: [

            {

                type:
                    'sentinel-2-l2a',

                dataFilter: {

                    timeRange: {

                        from:
                            `${date}T00:00:00Z`,

                        to:
                            `${date}T23:59:59Z`

                    },

                    mosaickingOrder:
                        'leastCC'

                }

            }

        ]

    },

   output: {

    width:
        isPointAnalysis
            ? 1536
            : 512,

    height:
        isPointAnalysis
            ? 1536
            : 512,


        responses: [

            {

                identifier:
                    'default',

                format: {

                    type:
                        'image/png'

                }

            }

        ]

    },

    evalscript:
        trueColorEvalscript

};

const trueColorResponse =
    await fetch(

        'https://sh.dataspace.copernicus.eu/process/v1',

        {

            method:
                'POST',

            headers: {

                'Authorization':
                    `Bearer ${token}`,

                'Content-Type':
                    'application/json',

                'Accept':
                    'image/png'

            },

            body:
                JSON.stringify(
                    trueColorProcessingRequest
                )

        }

    );

if (!trueColorResponse.ok) {

    const trueColorError =
        await trueColorResponse.text();

    throw new Error(
        `True Color Processing failed for ${date}: ${trueColorResponse.status} ${trueColorError}`
    );

}

const trueColorBuffer =
    Buffer.from(
        await trueColorResponse.arrayBuffer()
    );


                const satelliteDir =
                    path.join(

                        PUBLIC_DIR,

                        'satellite'

                    );


                if (
                    !fs.existsSync(
                        satelliteDir
                    )
                ) {

                    fs.mkdirSync(

                        satelliteDir,

                        {
                            recursive:
                                true
                        }

                    );

                }


                // ==================================================
                // اسم الملف مرتبط بالمصرف الحقيقي + AOI
                // ==================================================

                const safeDrainId =
                    String(
                        requestedAOI.drainId ||
                        'real-drain'
                    )
                        .replace(
                            /[^a-zA-Z0-9_-]/g,
                            '_'
                        );


                        // ==================================================
// 🎨 حفظ True Color PNG
// ==================================================

const trueColorFileName =
    `truecolor_${safeDrainId}_${date}.png`;

const trueColorFilePath =
    path.join(
        satelliteDir,
        trueColorFileName
    );

// ==================================================
// 🎨 TRUE COLOR PROFESSIONAL ENHANCEMENT
// تحسين بصري فقط — لا يؤثر على التحليل
// ==================================================
const enhancedTrueColorBuffer =
    await sharp(trueColorBuffer)
        .modulate({
            brightness: 1.04,
            saturation: 1.15
        })
        .linear(
            1.08,
            -8
        )
        .sharpen({
            sigma: 1.15,
            m1: 0.8,
            m2: 1.5
        })
        .png({
            compressionLevel: 6
        })
        .toBuffer();

fs.writeFileSync(
    trueColorFilePath,
    enhancedTrueColorBuffer
);

                const fileName =
                    `spectral_${safeDrainId}_${date}.tiff`;


                const filePath =
                    path.join(

                        satelliteDir,

                        fileName

                    );


                fs.writeFileSync(

                    filePath,

                    imageBuffer

                );


                console.log(

                    `💾 REAL drain spectral data saved: ${fileName}`

                );

return {

    date,

    fileName,

    url:
        `/satellite/${fileName}`,

    sizeBytes:
        imageBuffer.length,

   bands: [
    'B02',
    'B03',
    'B04',
    'B08',
    'B11'
],
    format:
        'image/tiff',

    // ==================================================
    // 🎨 TRUE COLOR IMAGE
    // ==================================================

    trueColorFileName,

    trueColorUrl:
        `/satellite/${trueColorFileName}`,

    trueColorFormat:
        'image/png'

};

            }


            

            // ==================================================
            // 1️⃣2️⃣ تحميل Baseline
            // ==================================================

            const baseline =
                await processDate(
                    baselineDate
                );


            // ==================================================
            // 1️⃣3️⃣ تحميل Current
            // ==================================================

            const current =
                await processDate(
                    currentDate
                );


            // ==================================================
            // 1️⃣4️⃣ مسارات ملفات Sentinel-2
            // ==================================================

            const satelliteDir =
                path.join(

                    PUBLIC_DIR,

                    'satellite'

                );


            const baselineFilePath =
                path.join(

                    satelliteDir,

                    baseline.fileName

                );


            const currentFilePath =
                path.join(

                    satelliteDir,

                    current.fileName

                );


            // ==================================================
            // 1️⃣5️⃣ التأكد من وجود الملفات
            // ==================================================

            if (
                !fs.existsSync(
                    baselineFilePath
                )
            ) {

                throw new Error(
                    `Baseline satellite file not found: ${baselineFilePath}`
                );

            }


            if (
                !fs.existsSync(
                    currentFilePath
                )
            ) {

                throw new Error(
                    `Current satellite file not found: ${currentFilePath}`
                );

            }


            // ==================================================
            // 1️⃣6️⃣ تشغيل NDVI + NDWI
            // ==================================================

            console.log('');
            console.log(
                '🧠 Running REAL NDVI + NDWI change detection...'
            );



// ==================================================
// تشغيل NDVI + NDWI داخل Buffer المصرف
// ==================================================

const ndviChange =
    await analyzeSatelliteChange(
        baselineFilePath,
        currentFilePath,
        bbox,
        bufferGeometry
    );

            // ==================================================
            // 1️⃣7️⃣ Satellite Change Detection Object
            // ==================================================

           const satelliteChangeDetection = {

    type:
        'NDVI_AND_WATER_VEGETATION_CHANGE',

  method:
    'Sentinel-2 B02/B03/B04/B08/B11 + NDVI + NDWI + NDBI land-cover classification',

    drainId:
        requestedAOI.drainId ||
        null,

    aoiMode:
        requestedAOI.basedOn ===
        'drain-location'
            ? 'drain-location'
            : 'drain-property',

    analysisPoint:
        requestedAOI.basedOn ===
        'drain-location' &&
        requestedAOI.analysisPoint
            ? {
                lat:
                    Number(
                        requestedAOI
                            .analysisPoint
                            .lat
                    ),

                lng:
                    Number(
                        requestedAOI
                            .analysisPoint
                            .lng
                    )
            }
            : null,

    chainageKm:
        requestedAOI.basedOn ===
        'drain-location'
            ? Number(
                requestedAOI.chainageKm
            )
            : null,

             aoi: {

    minLat,

    maxLat,

    minLng,

    maxLng,

    bbox,

    mode:
        requestedAOI.basedOn ===
        'drain-location'
            ? 'drain-location'
            : 'drain-property',

    analysisPoint:
        requestedAOI.basedOn ===
        'drain-location' &&
        requestedAOI.analysisPoint
            ? {
                lat:
                    Number(
                        requestedAOI
                            .analysisPoint
                            .lat
                    ),

                lng:
                    Number(
                        requestedAOI
                            .analysisPoint
                            .lng
                    )
            }
            : null,

    chainageKm:
        requestedAOI.basedOn ===
        'drain-location'
            ? Number(
                requestedAOI.chainageKm
            )
            : null,

    bufferMeters:
        Number(
            requestedAOI.bufferMeters ||
            50
        )

},
                baselineDate,

                currentDate,

                baselineCloudCover:
    baselineSelection.cloudCover,

currentCloudCover:
    currentSelection.cloudCover,

                lastAnalysisDate,

                meanBaselineNDVI:
                    ndviChange.meanBaselineNDVI,

                meanCurrentNDVI:
                    ndviChange.meanCurrentNDVI,

                meanDeltaNDVI:
                    ndviChange.meanDeltaNDVI,

                changePercentage:
                    ndviChange.changePercentage,

                changedPixels:
                    ndviChange.changedPixels,

              changedAreaM2:
    ndviChange.changedAreaM2,

// ==================================================
// REAL SPATIAL CHANGE GEOMETRY
// ==================================================

changeGeometry:
    ndviChange.changeGeometry,

    beforeLandCoverGeometry:
    ndviChange.beforeLandCoverGeometry,

afterLandCoverGeometry:
    ndviChange.afterLandCoverGeometry,

landCoverClassification:
    ndviChange.landCoverClassification,

changeGeometryType:
    ndviChange.changeGeometryType,

threshold:
    ndviChange.changeThreshold,
    
                waterHyacinth:
                    ndviChange.waterHyacinth

            };



            // ==================================================
// 🧠 Irrigation RL Agent Decision
// ==================================================

const irrigationAIInput = {

    caseId:
        requestedAOI.drainId ||
        `IRR-${Date.now()}`,

    meanDeltaNDVI:
        Number(ndviChange.meanDeltaNDVI ?? 0),

    ndwi:
        Number(
            ndviChange.waterHyacinth?.rawNdwi?.mean ??
            0
        ),

    changedAreaM2:
        Number(ndviChange.changedAreaM2 ?? 0),

    distanceToDrain: null,

    
    currentWaterPixels:
        Number(
            ndviChange.waterHyacinth
                ?.waterDiagnostics
                ?.currentWaterPixels ??
            0
        ),

    waterVegetationInteraction:
        Number(
            ndviChange.waterHyacinth
                ?.pixels
                ?.currentWaterVegetation ??
            0
        ),

    satelliteConfidence:
        Number(
            ndviChange.waterHyacinth?.confidence ?? 0
        ) / 100,

historicalRisk: null,


    fieldVerified:
        false
};


const irrigationAI =
    await irrigationAIDecide(irrigationAIInput);

// ==================================================
// 🧠 AI Decision Log
// ==================================================

console.log('');
console.log('🧠 IRRIGATION AI DECISION');
console.log('Action:', irrigationAI.action);
console.log('DQN Action:', irrigationAI.dqnAction);
console.log(
    'Evidence:',
    irrigationAI.evidenceCompleteness
);
console.log('Q Values:', irrigationAI.qValues);
console.log('State:', irrigationAI.state);
console.log('Reason:', irrigationAI.reason);
console.log('==========================================');


// ==================================================
// 🧠 RL LEARNING STEP
// ==================================================

const nextAIInput = {
    ...irrigationAIInput,

    // الحالة الجديدة بعد التحليل الحالي
    fieldVerified: false
};

await irrigationAILearn({
    previousData: irrigationAIInput,
    action: irrigationAI.action,
    nextData: nextAIInput,
    done: false
});

console.log('🧠 RL EXPERIENCE STORED');
console.log('Action:', irrigationAI.action);
console.log('Replay updated');
console.log('==========================================');


            // ==================================================
            // 1️⃣8️⃣ Log النتيجة النهائية
            // ==================================================

            console.log(
                '🛰️ REAL Satellite Change Detection Ready:'
            );


            console.log(

                JSON.stringify(

                    {

                        drainId:
                            requestedAOI.drainId ||
                            null,

                        bbox,

                        baselineDate,

                        currentDate,

                        changePercentage:
                            ndviChange.changePercentage,

                        changedAreaM2:
                            ndviChange.changedAreaM2,

                        meanDeltaNDVI:
                            ndviChange.meanDeltaNDVI,

                        waterHyacinth:
                            ndviChange.waterHyacinth

                    },

                    null,

                    2

                )

            );


            console.log(
                '=========================================='
            );

            console.log(
                '✅ REAL DRAIN SATELLITE ANALYSIS COMPLETE'
            );

            console.log(
                '=========================================='
            );


            // ==================================================
            // 1️⃣9️⃣ API Response
            // ==================================================

            return res.json({

                success:
                    true,

                source:
                    'Copernicus Data Space',

                collection:
                    'sentinel-2-l2a',

                comparison: {

                    latitude:
                        lat,

                    longitude:
                        lng,

                    drainId:
                        requestedAOI.drainId ||
                        null,

                    aoi: {

                        minLat,

                        maxLat,

                        minLng,

                        maxLng,

                        bbox

                    },

                    bbox,

                    baseline,

                    current,

                bands: [

    'B02',
    'B03',
    'B04',
    'B08',
    'B11'

],
                   ndviChange,

    satelliteChangeDetection,

    // 🧠 REAL AI DECISION
    irrigationAI
                }

            });

        }


        catch (error) {

            console.error(
                '❌ REAL Satellite comparison failed:',
                error
            );


            return res.status(500).json({

                success:
                    false,

                message:
                    'Real drain satellite comparison failed.',

                error:
                    error.message

            });

        }

    }
);


// ======================================================
// المرحلة الثانية
// SATELLITE + ENGINEERING AI PIPELINE
//
// POST /api/satellite/analyze
//
// Pipeline:
//
// Satellite Analyzer
//        ↓
// Satellite Measurements
//        ↓
// Engineering AI
//        ↓
// Risk Score
//        ↓
// Engineering Decision
//        ↓
// Engineering Case
//        ↓
// Dashboard
// ======================================================

app.post(
    '/api/satellite/analyze',
    async (req, res) => {

        try {

            console.log('');

            console.log(
                '=========================================='
            );

            console.log(
                '🛰️ SATELLITE ANALYSIS REQUEST'
            );

            console.log(
                '=========================================='
            );


            // ==================================================
            // 1. تشغيل Satellite Analyzer
            // ==================================================

            const satelliteModule =
                await import(
                    './satellite/satelliteAnalyzer.js'
                );


            let satelliteAnalysis;


            if (
                typeof satelliteModule.analyzeSatellite
                === 'function'
            ) {

                satelliteAnalysis =
                    await satelliteModule.analyzeSatellite(
                        req.body || {}
                    );

            }

            else if (
                typeof satelliteModule.runSatelliteAnalysis
                === 'function'
            ) {

                satelliteAnalysis =
                    await satelliteModule.runSatelliteAnalysis(
                        req.body || {}
                    );

            }

            else if (
                typeof satelliteModule.default
                === 'function'
            ) {

                satelliteAnalysis =
                    await satelliteModule.default(
                        req.body || {}
                    );

            }

            else {

                return res.status(500).json({

                    success: false,

                    message:
                        'Satellite analyzer function was not exported.',

                    hint:
                        'Export analyzeSatellite() from satelliteAnalyzer.js'

                });

            }


            // ==================================================
            // 2. التحقق من Satellite Analysis
            // ==================================================

            if (
                !satelliteAnalysis ||
                !satelliteAnalysis.detection
            ) {

                return res.status(500).json({

                    success: false,

                    message:
                        'Invalid satellite analysis result.',

                    analysis:
                        satelliteAnalysis

                });

            }


            // ==================================================
            // 3. استخراج Detection + Measurements
            // ==================================================

            const detection =
                satelliteAnalysis.detection || {};

            const measurements =
                satelliteAnalysis.measurements || {};


            // ==================================================
            // 4. تجهيز البيانات للـ Engineering AI
            // ==================================================

            const engineeringInput = {

                // ----------------------------------------------
                // GIS / Engineering
                // ----------------------------------------------

                distanceToDrain:
                    Number(
                        req.body?.distanceToDrain ??
                        satelliteAnalysis.distanceToDrain ??
                        measurements.distanceToDrain ??
                        0
                    ),


                // ----------------------------------------------
                // Satellite measurable features
                // ----------------------------------------------

                changeArea:
                    Number(
                        measurements.changeAreaM2 ??
                        detection.changeArea ??
                        0
                    ),


                changePercentage:
                    Number(
                        measurements.changePercentage ??
                        detection.changePercentage ??
                        0
                    ),


                structureDetected:
                    Boolean(
                        detection.structureDetected
                    ),


                roadDetected:
                    Boolean(
                        detection.roadDetected
                    ),


                waterChange:
                    Boolean(
                        detection.waterChange
                    ),


                vegetationChange:
                    Number(
                        measurements.vegetationChangePercentage ??
                        detection.vegetationChange ??
                        0
                    ),


                // ----------------------------------------------
                // Historical context
                // ----------------------------------------------

                historicalRisk:
                    Number(
                        measurements.historicalRisk ??
                        satelliteAnalysis.historicalRisk ??
                        0
                    ),


                inspectionHistory:
                    Number(
                        measurements.inspectionHistory ??
                        satelliteAnalysis.inspectionHistory ??
                        0
                    ),


                // ----------------------------------------------
                // Satellite confidence
                // ----------------------------------------------

                confidenceScore:
                    Number(
                        measurements.confidenceScore ??
                        satelliteAnalysis.confidenceScore ??
                        0
                    )

            };


            console.log(
                '📐 Engineering AI Input:'
            );

            console.log(
                engineeringInput
            );



const irrigationAIInput = {
    caseId:
        req.body?.caseId ||
        req.body?.drainId ||
        `IRR-${Date.now()}`,

    meanDeltaNDVI: Number(
        measurements?.meanDeltaNDVI ??
        satelliteAnalysis?.meanDeltaNDVI ??
        0
    ),

    ndwi: Number(
        measurements?.ndwi ??
        measurements?.meanNDWI ??
        satelliteAnalysis?.ndwi ??
        0
    ),

    changedAreaM2: Number(
        measurements?.changeAreaM2 ??
        satelliteAnalysis?.changeArea ??
        0
    ),

    distanceToDrain: Number(
        engineeringInput.distanceToDrain ?? 0
    ),

    currentWaterPixels: Number(
        measurements?.currentWaterPixels ??
        satelliteAnalysis?.currentWaterPixels ??
        0
    ),

    waterVegetationInteraction: Number(
        measurements?.waterVegetationInteraction ??
        satelliteAnalysis?.waterVegetationInteraction ??
        0
    ),

    satelliteConfidence: Math.min(
        1,
        Math.max(
            0,
            Number(engineeringInput.confidenceScore ?? 0)
        )
    ),

   historicalRisk: realHistoricalRisk,

    fieldVerified: Boolean(
        req.body?.fieldVerified ?? false
    )
};

const irrigationAI = irrigationAIDecide(irrigationAIInput);


console.log('\n🧠 IRRIGATION AI DECISION');
console.log('Action:', irrigationAI.action);
console.log('DQN Action:', irrigationAI.dqnAction);
console.log('Evidence:', irrigationAI.evidenceCompleteness);
console.log('Q Values:', irrigationAI.qValues);
console.log('State:', irrigationAI.state);
console.log('Reason:', irrigationAI.reason);
console.log('============================\n');


            // ==================================================
            // 5. تشغيل Engineering AI
            // ==================================================

            const engineeringAI =
                await analyzeEngineeringCase(
                    engineeringInput
                );

                const realEngineeringRisk =
    Math.min(
        1,
        Math.max(
            0,
            Number(
                engineeringAI?.riskScore ?? 0
            ) / 100
        )
    );


                const realHistoricalRisk =
    Math.min(
        1,
        Math.max(
            0,
            Number(
                engineeringAI?.riskScore ??
                0
            ) / 100
        )
    );


            if (
                !engineeringAI ||
                engineeringAI.success !== true
            ) {

                return res.status(500).json({

                    success: false,

                    message:
                        'Engineering AI analysis failed.',

                    satelliteAnalysis,

                    engineeringAI

                });

            }


            // ==================================================
            // 6. قراءة الحالات الحالية
            // ==================================================

            const cases =
                readCases();


            // ==================================================
            // 7. إنشاء Case ID
            // ==================================================

            const caseId =
                generateCaseId(cases);


            // ==================================================
            // 8. إنشاء Engineering Case
            // ==================================================

            const engineeringCase = {

                caseId,


                createdAt:
                    new Date().toISOString(),


                source:
                    'satellite',

                aiAgent: {
                    action: irrigationAI.action,
                    dqnAction: irrigationAI.dqnAction,
                    reason: irrigationAI.reason,
                    qValues: irrigationAI.qValues,
                    evidenceCompleteness: irrigationAI.evidenceCompleteness,
                    epsilon: irrigationAI.epsilon,
                    state: irrigationAI.state,
                    timestamp: irrigationAI.timestamp
                },
                // ----------------------------------------------
                // Drain
                // ----------------------------------------------

                drainId:
                    satelliteAnalysis.drainId ||
                    req.body?.drainId ||
                    'DR-001',


                governorate:
                    req.body?.governorate ||
                    'الإسماعيلية',


                center:
                    req.body?.center ||
                    'التل الكبير',


                coordinates:
                    satelliteAnalysis.coordinates ||
                    req.body?.coordinates ||
                    {
                        lat: 30.5,
                        lng: 32.3
                    },


                // ==================================================
                // Satellite Detection
                // ==================================================

                detection: {

                    changeArea:
                        engineeringInput.changeArea,


                    changePercentage:
                        engineeringInput.changePercentage,


                    structureDetected:
                        engineeringInput.structureDetected,


                    roadDetected:
                        engineeringInput.roadDetected,


                    waterChange:
                        engineeringInput.waterChange,


                    vegetationChange:
                        engineeringInput.vegetationChange

                },


                // ==================================================
                // Engineering AI
                // ==================================================

                ai: {

                    riskScore:
                        Number(
                            engineeringAI.riskScore || 0
                        ),


                    confidence:
                        Number(
                            engineeringAI.measurements
                                ?.confidenceScore ||
                            engineeringInput.confidenceScore ||
                            0
                        ),


                    severity:
                        engineeringAI.severity ||
                        'low',


                    reason:
                        engineeringAI.reason ||
                        'تم تحليل الحالة هندسيًا.',


                    modelVersion:
                        engineeringAI.modelVersion ||
                        'engineering-risk-v2',


                    riskFactors:
                        engineeringAI.riskFactors ||
                        []

                },


                // ==================================================
                // Engineering Decision
                // ==================================================

                decision: {

                    action:
                        engineeringAI.action ||
                        'monitor',


                    status:
                        engineeringAI.status ||
                        'monitoring',


                    reason:
                        engineeringAI.reason ||
                        'تم تحليل الحالة هندسيًا.'

                },


                // ==================================================
                // Inspection
                // ==================================================

                inspection: {

                    required:
                        engineeringAI.action ===
                            'field_inspection' ||
                        engineeringAI.action ===
                            'urgent_intervention',


                    status:
                        engineeringAI.action ===
                            'field_inspection' ||
                        engineeringAI.action ===
                            'urgent_intervention'
                            ? 'pending'
                            : 'not_required',


                    history:
                        engineeringInput.inspectionHistory

                },


                // ==================================================
                // Historical Risk
                // ==================================================

                historicalRisk:
                    engineeringInput.historicalRisk,


                // ==================================================
                // Measurements
                // ==================================================

                measurements: {

                    distanceToDrain:
                        engineeringInput.distanceToDrain,


                    changeAreaM2:
                        engineeringInput.changeArea,


                    changePercentage:
                        engineeringInput.changePercentage,


                    vegetationChangePercentage:
                        engineeringInput.vegetationChange,


                    confidenceScore:
                        engineeringInput.confidenceScore

                },


                // ==================================================
                // Satellite Metadata
                // ==================================================

                satellite: {

                    analyzerVersion:
                        satelliteAnalysis.analyzerVersion ||
                        'unknown',


                    source:
                        satelliteAnalysis.source ||
                        'satellite',


                    analyzedAt:
                        new Date().toISOString()

                }

            };


            // ==================================================
            // 9. حفظ الحالة
            // ==================================================

            cases.push(
                engineeringCase
            );

            saveCases(cases);


            // ==================================================
            // 10. Console Output
            // ==================================================

            console.log(
                `🆕 New Engineering Case: ${caseId}`
            );


            console.log(
                `🛰️ Drain: ${engineeringCase.drainId}`
            );


            console.log(
                `📊 Risk: ${engineeringCase.ai.riskScore}/100`
            );


            console.log(
                `🎯 Confidence: ${engineeringCase.ai.confidence}%`
            );


            console.log(
                `⚙️ Action: ${engineeringCase.decision.action}`
            );


            console.log(
                `📌 Status: ${engineeringCase.decision.status}`
            );


            console.log(
                '=========================================='
            );

            console.log('');


            // ==================================================
            // 11. API Response
            // ==================================================

            return res.status(201).json({

                success: true,


                message:
                    'Satellite analysis completed, Engineering AI decision generated, and engineering case created.',


                pipeline: {

                    satellite:
                        satelliteAnalysis,


                    engineeringAI:
                        engineeringAI

                },


                case:
                    engineeringCase

            });

        }


        catch (error) {

            console.error(
                '❌ Satellite / Engineering AI API Error:',
                error
            );


            return res.status(500).json({

                success: false,


                message:
                    'Satellite and Engineering AI analysis failed.',


                error:
                    error.message

            });

        }

    }
);


// ======================================================
// API: إنشاء Case يدويًا للاختبار
// ======================================================

app.post(
    '/api/cases',
    (req, res) => {

        try {

            const cases =
                readCases();


            const caseId =
                generateCaseId(cases);


            const newCase = {

                caseId,


                createdAt:
                    new Date().toISOString(),


                source:
                    req.body.source ||
                    'manual',


                drainId:
                    req.body.drainId ||
                    'DR-001',


                governorate:
                    req.body.governorate ||
                    'الإسماعيلية',


                center:
                    req.body.center ||
                    'التل الكبير',


                coordinates:
                    req.body.coordinates ||
                    {
                        lat: 30.5,
                        lng: 32.3
                    },


                detection:
                    req.body.detection ||
                    {},


                ai:
                    req.body.ai ||
                    {

                        riskScore: 0,

                        confidence: 0,

                        severity: 'low',

                        reason: 'Manual case'

                    },


                decision:
                    req.body.decision ||
                    {

                        action: 'verify',

                        status: 'new'

                    }

            };


            cases.push(newCase);

            saveCases(cases);


            res.status(201).json({

                success: true,

                case: newCase

            });

        }


        catch (error) {

            console.error(
                '❌ Error creating case:',
                error.message
            );


            res.status(500).json({

                success: false,

                error:
                    error.message

            });

        }

    }
);



// ======================================================
// API: حفظ Engineering Case الناتج من Real Drain Analysis
// ======================================================

app.post(
    '/api/cases/save-analysis',
    (req, res) => {

        try {

            const incomingCase =
                req.body?.case;

            if (
                !incomingCase ||
                typeof incomingCase !== 'object'
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        'Engineering case data is required.'
                });
            }

            const cases =
                readCases();

            // ----------------------------------------------
            // إنشاء Case ID على السيرفر
            // ----------------------------------------------

            const caseId =
                generateCaseId(cases);

            // ----------------------------------------------
            // نحتفظ بكل بيانات التحليل القادمة
            // ----------------------------------------------

            const savedCase = {

                ...incomingCase,

                caseId,

                createdAt:
                    incomingCase.createdAt ||
                    new Date().toISOString(),

                savedAt:
                    new Date().toISOString(),

                source:
                    incomingCase.source ||
                    'real-drain-satellite-analysis'
            };

            // ----------------------------------------------
            // حفظ الحالة
            // ----------------------------------------------

            cases.push(savedCase);

            saveCases(cases);

            console.log(
                '💾 REAL DRAIN ANALYSIS SAVED'
            );

            console.log(
                'Case ID:',
                savedCase.caseId
            );

            console.log(
                'Drain ID:',
                savedCase.drainId
            );

            console.log(
                'Total Cases:',
                cases.length
            );

            return res.status(201).json({

                success: true,

                message:
                    'Real drain analysis case saved successfully.',

                case:
                    savedCase,

                totalCases:
                    cases.length
            });

        }

        catch (error) {

            console.error(
                '❌ Save real drain analysis error:',
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    'Failed to save real drain analysis case.',

                error:
                    error.message
            });
        }
    }
);

// ======================================================
// Health Check
// ======================================================

app.get(
    '/api/health',
    (req, res) => {

        res.json({

            success: true,

            system:
                'IRRIGATION AI',

            status:
                'online',

            timestamp:
                new Date().toISOString()

        });

    }
);


// ======================================================
// الصفحة الرئيسية
// ======================================================

app.get(
    '/',
    (req, res) => {

        res.sendFile(
            path.join(
                PUBLIC_DIR,
                'dashboard.html'
            )
        );

    }
);


// ======================================================
// 404 API
// ======================================================

app.use(
    '/api',
    (req, res) => {

        res.status(404).json({

            success: false,

            message:
                'API endpoint not found'

        });

    }
);


// ======================================================
// تشغيل السيرفر
// ======================================================

app.listen(
    PORT,
    () => {

        console.log('');

        console.log(
            '=========================================='
        );

        console.log(
            '       IRRIGATION AI SERVER'
        );

        console.log(
            '=========================================='
        );

        console.log(
            `🚀 Server: http://localhost:${PORT}`
        );

        console.log(
            `📊 Dashboard: http://localhost:${PORT}/`
        );

        console.log(
            `🛰️ Satellite API: http://localhost:${PORT}/api/satellite/analyze`
        );

        console.log(
            `🧠 Cases API: http://localhost:${PORT}/api/cases`
        );

        console.log(
            `📈 Stats API: http://localhost:${PORT}/api/stats`
        );

        console.log(
            `💚 Health: http://localhost:${PORT}/api/health`
        );

        console.log(
            '=========================================='
        );

        console.log('');

    }
);