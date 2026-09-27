// ======================================================
// IRRIGATION AI
// Dashboard Data Controller
// ======================================================

const API_BASE = '';

console.log(
    '🧪 DASHBOARD JS VERSION:',
    'V2 PANEL TEST - 2026'
);
// ======================================================
// GIS GLOBAL VARIABLES
// ======================================================

let gisMap = null;

let caseMarker = null;

let changeZone = null;

let drainLine = null;

let drainGeoJsonData = null;

let nearestPointMarker = null;

let caseToDrainLine = null;

let drainBufferLayer = null;

let drainAOILayer = null;

let realDrainLayer = null;

// طبقة أملاك المصارف الحقيقية
let realDrainPropertyLayer = null;

let selectedRealDrainLayer = null;

// طبقة أملاك المصرف المختار
let selectedRealDrainPropertyLayer = null;

let selectedRealDrain = null;

// ==================================================
// LIVE CASE MONITORING LAYER
// ==================================================
let liveCaseLayer = null;
let liveCaseRefreshTimer = null;

// حالة ظهور تحليل المصارف اللايف
let liveCaseLayerVisible = false;

// ===============================
// Satellite analysis point mode
// ===============================

let satelliteAnalysisMode = 'drain-property';

let satellitePointSelectionActive = false;

let selectedSatellitePoint = null;

let selectedSatellitePointMarker = null;


// ======================================================
// CASES GLOBAL VARIABLES
// ======================================================

let allCases = [];
let selectedCaseIndex = -1;

// ======================================================
// تحميل الحالات
// ======================================================

async function loadCases(
    shouldRender = true
) {
    try {

        const response = await fetch(
            `${API_BASE}/api/cases`
        );

        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );

        }

        const data =
            await response.json();

        console.log(
            '📡 Cases loaded:',
            data
        );

        if (
            data.success &&
            Array.isArray(data.cases)
        ) {

            allCases =
                data.cases;


                // ==================================================
// LIVE CASES — ALWAYS KEEP LATEST ANALYSIS PER DRAIN
// ==================================================

if (
    Array.isArray(allCases) &&
    allCases.length > 0
) {

    const latestCasesByDrain =
        new Map();

    allCases.forEach(
        (item, index) => {

            const drainId =
                String(
                    item?.drainId ||
                    item?.drain?.id ||
                    item?.satelliteChangeDetection?.drainId ||
                    ''
                );

            if (!drainId) {
                return;
            }

            const currentDateTime =
                new Date(
                    item?.satelliteChangeDetection?.currentDate ||
                    0
                ).getTime();

            const createdAtTime =
                new Date(
                    item?.createdAt ||
                    0
                ).getTime();

            const existing =
                latestCasesByDrain.get(
                    drainId
                );

            if (
                !existing ||
                currentDateTime >
                    existing.currentDateTime ||
                (
                    currentDateTime ===
                    existing.currentDateTime &&
                    createdAtTime >
                    existing.createdAtTime
                )
            ) {

                latestCasesByDrain.set(
                    drainId,
                    {
                        item,
                        index,
                        currentDateTime,
                        createdAtTime
                    }
                );

            }

        }
    );

    console.log(
        '🛰️ LATEST CASE PER DRAIN:',
        Array.from(
            latestCasesByDrain.values()
        ).map(x => ({
            drainId:
                x.item?.drainId,

            caseId:
                x.item?.caseId,

            currentDate:
                x.item
                    ?.satelliteChangeDetection
                    ?.currentDate,

            createdAt:
                x.item?.createdAt
        }))
    );

}
         // ------------------------------------------
// عند فتح الصفحة دائمًا نبدأ بآخر حالة
// ------------------------------------------
// ------------------------------------------
// تحديد الحالة الافتراضية عند أول تشغيل فقط
// ------------------------------------------

if (
    selectedCaseIndex < 0 ||
    selectedCaseIndex >= allCases.length
) {
    selectedCaseIndex =
        allCases.length - 1;

    console.log(
        '🏁 Default case on startup:',
        allCases[selectedCaseIndex]
    );
}
            // ------------------------------------------
            // إنشاء قائمة الحالات مرة واحدة
            // ------------------------------------------

            updateCaseSelector(
                allCases
            );

            // ------------------------------------------
            // عرض الحالة المختارة
            // ------------------------------------------

if (shouldRender) {
    renderSelectedCase();
}
        }

    } catch (error) {

        console.error(
            '❌ Failed to load cases:',
            error
        );

    }

}

// ======================================================
// تحميل الإحصائيات
// ======================================================

async function loadStats() {

    try {

        const response =
            await fetch(
                `${API_BASE}/api/stats`
            );

        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );

        }

        const data =
            await response.json();

        console.log(
            '📊 Stats loaded:',
            data
        );

        if (data.success) {

            updateStats(
                data.stats
            );

        }

    } catch (error) {

        console.error(
            '❌ Failed to load stats:',
            error
        );

    }

}

// ======================================================
// تحديث الإحصائيات
// ======================================================

function updateStats(stats) {

    const cards =
        document.querySelectorAll(
            '.stat-value'
        );

    if (cards.length >= 4) {

        cards[0].textContent =
            stats.total ?? 0;

        cards[1].textContent =
            stats.highRisk ?? 0;

        cards[2].textContent =
            stats.fieldInspection ?? 0;

        cards[3].textContent =
            `${stats.averageConfidence ?? 0}%`;

    }

}

// ======================================================
// تحديد مستوى الخطورة
// ======================================================

function getRiskLevel(riskScore) {

    const score =
        Number(riskScore) || 0;

    if (score >= 85) {

        return {

            label:
                'عالية الخطورة',

            color:
                '#ef4444',

            fillColor:
                '#ef4444'

        };

    }

    if (score >= 60) {

        return {

            label:
                'متوسطة الخطورة',

            color:
                '#f59e0b',

            fillColor:
                '#f59e0b'

        };

    }

    return {

        label:
            'منخفضة الخطورة',

        color:
            '#22c55e',

        fillColor:
            '#22c55e'

    };

}

// ======================================================
// قائمة اختيار الحالات
// ======================================================

function updateCaseSelector(cases) {

    const selector =
        document.getElementById(
            'caseSelect'
        );

    if (!selector) {

        console.warn(
            '⚠️ caseSelect not found'
        );

        return;

    }

    selector.innerHTML = '';

    if (
        !Array.isArray(cases) ||
        cases.length === 0
    ) {

        const option =
            document.createElement(
                'option'
            );

        option.value = '';

        option.textContent =
            'لا توجد حالات';

        selector.appendChild(
            option
        );

        return;

    }

    cases.forEach(
        (item, index) => {

            const option =
                document.createElement(
                    'option'
                );

            option.value =
                String(index);

            option.textContent =
                `${item.caseId || `CASE ${index + 1}`} — ${item.drainId || '-'}`;

            selector.appendChild(
                option
            );

        }
    );

    // ------------------------------------------
    // تحديد الحالة الحالية
    // ------------------------------------------

    if (
        selectedCaseIndex >= 0 &&
        selectedCaseIndex < cases.length
    ) {

        selector.value =
            String(selectedCaseIndex);

    }

}
// ======================================================
// اختيار حالة
// ======================================================

function selectCase(index) {

    const newIndex =
        Number(index);

    console.log(
        '🔄 Changing case to index:',
        newIndex
    );

    // ------------------------------------------
    // التأكد أن الحالة موجودة
    // ------------------------------------------

    if (
        !Number.isInteger(newIndex) ||
        !Array.isArray(allCases) ||
        !allCases[newIndex]
    ) {

        console.warn(
            '⚠️ Invalid case index:',
            newIndex
        );

        return;
    }

    // ------------------------------------------
    // تحديد الحالة
    // ------------------------------------------

    selectedCaseIndex =
        newIndex;

    const selectedCase =
        allCases[selectedCaseIndex];

    console.log(
        '🎯 SELECTED CASE:',
        selectedCase
    );

    console.log(
        '🎯 SELECTED CASE ID:',
        selectedCase.caseId
    );

    console.log(
        '🎯 SELECTED DRAIN:',
        selectedCase.drainId
    );

    // ------------------------------------------
    // مهم:
    // تحديث بيانات المصرف المختار
    // لو كانت الحالة ناتجة من Real Drain
    // ------------------------------------------

    if (
        selectedCase.drainId &&
        drainGeoJsonData?.features
    ) {

        const drainFeature =
            drainGeoJsonData.features.find(
                feature =>
                    String(
                        feature.properties?.drainId
                    ) ===
                    String(
                        selectedCase.drainId
                    )
            );

        if (drainFeature) {

            selectedRealDrain =
                drainFeature;

            window.selectedRealDrain =
                drainFeature;

            console.log(
                '🗺️ Real drain restored for case:',
                selectedCase.drainId
            );
        }
    }

    // ------------------------------------------
    // تحديث العرض
    // ------------------------------------------

    renderSelectedCase();

    // ------------------------------------------
    // تأكيد selector
    // ------------------------------------------

    const selector =
        document.getElementById(
            'caseSelect'
        );

    if (selector) {

        selector.value =
            String(selectedCaseIndex);
    }

    console.log(
        '✅ Case rendering completed:',
        selectedCase.caseId
    );
}
// ======================================================
// عرض الحالة المختارة
// ======================================================

function renderSelectedCase() {

    if (
        !Array.isArray(allCases) ||
        allCases.length === 0
    ) {

        console.warn(
            '⚠️ No cases available'
        );

        return;

    }

    // ------------------------------------------
    // حماية index
    // ------------------------------------------

    if (
        selectedCaseIndex < 0 ||
        selectedCaseIndex >= allCases.length
    ) {

        selectedCaseIndex =
            allCases.length - 1;

    }

    const currentCase =
        allCases[selectedCaseIndex];

    if (!currentCase) {

        console.error(
            '❌ Current case not found'
        );

        return;

    }

    console.log(
        '🎯 Rendering selected case:',
        currentCase
    );

    const detection =
        currentCase.detection || {};

    const ai =
        currentCase.ai || {};

    const decision =
        currentCase.decision || {};

    const coordinates =
        currentCase.coordinates || {};

    // ==================================================
    // CASE ID
    // ==================================================

    const caseIdElement =
        document.querySelector(
            '.case-id'
        );

    if (caseIdElement) {

        caseIdElement.textContent =
            `CASE ID: ${currentCase.caseId || '-'}`;

    }

    // ==================================================
    // CASE TITLE
    // ==================================================

    const caseTitleElement =
        document.querySelector(
            '.case-title'
        );

    if (caseTitleElement) {

    if (
    currentCase.source === 'satellite' ||
    currentCase.source === 'real_drain_satellite'
) {

    caseTitleElement.textContent =
        'رصد تغير محتمل في نطاق المصرف';

} else {

    caseTitleElement.textContent =
        'Engineering Case';

}
    }

    // ==================================================
    // DETAILS
    // ==================================================

    const detailValues =
        document.querySelectorAll(
            '.detail-value'
        );

    if (detailValues.length >= 6) {

        detailValues[0].textContent =
            currentCase.drainId || '-';

        detailValues[1].textContent =
            currentCase.governorate || '-';

        detailValues[2].textContent =
            currentCase.center || '-';

        detailValues[3].textContent =
            `${detection.changeArea ?? 0} m²`;

        detailValues[4].textContent =
            `${detection.changePercentage ?? 0}%`;

        detailValues[5].textContent =
            `${ai.confidence ?? 0}%`;

    }

    // ==================================================
    // RISK
    // ==================================================

    const riskNumber =
        document.querySelector(
            '.risk-number'
        );

   if (riskNumber) {

    riskNumber.innerHTML = `
        ${
            currentCase.engineeringRisk?.riskScore ??
            ai.riskScore ??
            0
        }
        <span style="
            font-size:16px;
        ">
            /100
        </span>
    `;

    }

    // ==================================================
    // ACTION
    // ==================================================

    const actionElement =
        document.querySelector(
            '.action'
        );

    if (actionElement) {

       const action =
    currentCase.engineeringRisk?.action ??
    decision.action;

        const labels = {

            urgent_intervention:
                '🔴 تدخل عاجل',

            field_inspection:
                '🟠 تحتاج معاينة ميدانية',

           verify:
    '🟡 تحتاج تحقق هندسي',

inspection:
    '🟠 تحتاج معاينة ميدانية',

monitor:
    '🟢 متابعة'
        };

        actionElement.textContent =
            labels[action] ||
            action ||
            'متابعة';

    }

    // ==================================================
    // AI ANALYSIS
    // ==================================================

  const analysisElement =
    document.querySelector(
        '.analysis-content'
    );

if (analysisElement) {

    const reason =
        currentCase.finalDecision?.reason ||
        currentCase.reason ||
        ai.reason ||
        'لم يتم تسجيل تحليل هندسي للحالة.';

    analysisElement.innerHTML =
        reason;
}

    // ==================================================
    // تحديث GIS
    // ==================================================


console.log(
    '🚀 ABOUT TO UPDATE GIS',
    {
        caseId: currentCase.caseId,
        gisMapReady: !!gisMap
    }
);

updateGISMarker(
    currentCase
);
    // ==================================================
    // تحديث Select بدون إعادة إنشاء القائمة
    // ==================================================

    const selector =
        document.getElementById(
            'caseSelect'
        );

    if (selector) {

        selector.value =
            String(selectedCaseIndex);

    }

    console.log(
        '------------------------------------------'
    );

    console.log(
    'IRRIGATION AI CURRENT CASE'
);

console.log(
    `Case Index: ${selectedCaseIndex}`
);

console.log(
    `Case ID: ${currentCase.caseId}`
);

console.log(
    `Drain: ${currentCase.drainId}`
);

console.log(
    `Coordinates: ${coordinates.lat}, ${coordinates.lng}`
);

const irrigationAI =
    currentCase?.irrigationAI ?? null;

const irrigationAIAction =
    irrigationAI?.action ??
    decision?.action ??
    'monitor';

const irrigationAIReason =
    irrigationAI?.reason ??
    decision?.reason ??
    'AI decision support';

console.log(
    '🧠 DASHBOARD USING REAL IRRIGATION AI:',
    irrigationAI
);

const satelliteChange =
    currentCase.satelliteChangeDetection ??
    window.latestSatelliteChangeDetection ??
    {};

const waterVegetation =
    satelliteChange.waterHyacinth ??
    {};

console.log(
    `Engineering Risk: ${
        currentCase.engineeringRisk?.riskScore ??
        ai.riskScore ??
        0
    }/100`
);

console.log(
    `AI Recommendation: ${irrigationAIAction}`
);

console.log(
    `AI Reason: ${irrigationAIReason}`
);

console.log(
    `Satellite Change: ${
        satelliteChange.changePercentage ?? 0
    }%`
);

console.log(
    `Changed Area: ${
        satelliteChange.changedAreaM2 ?? 0
    } m²`
);

console.log(
    `Water-Vegetation Candidate: ${
        waterVegetation.detected
            ? 'DETECTED'
            : 'NOT DETECTED'
    }`
);

console.log(
    `AI Confidence: ${
        waterVegetation.confidence ?? 0
    }%`
);

console.log(
    '------------------------------------------'
);


}

// ======================================================
// تحديث GIS
// Marker + Change Zone + Drain
// ======================================================


// ==================================================
// REAL DRAIN GIS — تحميل المصارف الحقيقية من Backend
// ==================================================

// ==================================================
// REAL DRAIN GIS — تحميل المصارف الحقيقية من Backend
// ==================================================

async function loadDrainsGeoJSON() {

    try {

        console.log(
            '🗺️ Loading REAL drains from /api/drains...'
        );

        const response =
            await fetch(
                `${API_BASE}/api/drains`,
                {
                    cache: 'no-store'
                }
            );

        if (!response.ok) {

            throw new Error(
                `Real drains API HTTP ${response.status}`
            );

        }

        const result =
            await response.json();

        if (
            !result ||
            result.success !== true ||
            !Array.isArray(result.drains)
        ) {

            throw new Error(
                result?.error ||
                'Invalid real drains API response'
            );

        }

        // ------------------------------------------
        // تحويل Response إلى FeatureCollection
        // ------------------------------------------

        drainGeoJsonData = {

            type: 'FeatureCollection',

            features:
                result.drains
                    .filter(
                        drain =>
                            drain.geometry &&
                            (
                                drain.geometry.type ===
                                    'LineString' ||
                                drain.geometry.type ===
                                    'MultiLineString'
                            )
                    )
                    .map(
                        drain => ({

                            type: 'Feature',

                            properties: {

                                drainId:
                                    drain.id,

                                name:
                                    drain.name,

                                lengthM:
                                    drain.lengthM,

                                lengthKm:
                                    drain.lengthKm,

                                pointCount:
                                    drain.pointCount,

                                // ==================================
                                // أملاك المصرف الحقيقية
                                // ==================================

                                propertyCount:
                                    drain.propertyCount || 0,

                                propertyGeometry:
                                    Array.isArray(
                                        drain.propertyGeometry
                                    )
                                        ? drain.propertyGeometry
                                        : []

                            },

                            geometry:
                                drain.geometry

                        })
                    )

        };

        console.log(
            '✅ REAL drains loaded:',
            {
                apiCount:
                    result.count,

                mappedFeatures:
                    drainGeoJsonData.features.length,

                firstDrain:
                    drainGeoJsonData.features[0],

                firstDrainProperties:
                    drainGeoJsonData.features[0]?.properties
            }
        );

        return drainGeoJsonData;

    } catch (error) {

        console.error(
            '❌ Failed to load REAL drains:',
            error
        );

        drainGeoJsonData =
            null;

        return null;

    }
}

// ==================================================
// REAL GIS MODE — HIDE VIRTUAL DRAIN
// ==================================================

function hideVirtualDrainLayer() {

    if (!gisMap) {
        return;
    }

    // Remove old virtual drain
    if (drainLine) {

        gisMap.removeLayer(
            drainLine
        );

        drainLine = null;

        console.log(
            '🧹 Virtual drain layer removed'
        );
    }

    // Remove old virtual buffer
    if (drainBufferLayer) {

        gisMap.removeLayer(
            drainBufferLayer
        );

        drainBufferLayer = null;

        console.log(
            '🧹 Virtual drain buffer removed'
        );
    }
}


// ==================================================
// REAL DRAINS — DRAW ALL REAL DRAINS
// ==================================================

// ==================================================
// REAL DRAINS — DRAW ALL REAL DRAINS
// ==================================================

function renderRealDrainsOnMap() {

    if (!gisMap) {

        console.warn(
            '⚠️ GIS map is not ready'
        );

        return;
    }

    if (
        !drainGeoJsonData ||
        !Array.isArray(
            drainGeoJsonData.features
        )
    ) {

        console.warn(
            '⚠️ Real drain GeoJSON unavailable'
        );

        return;
    }

    // ==========================================
    // إخفاء أي مصرف افتراضي قديم
    // ==========================================

    hideVirtualDrainLayer();

    // ==========================================
    // إزالة طبقة المصارف القديمة
    // ==========================================

    if (realDrainLayer) {

        gisMap.removeLayer(
            realDrainLayer
        );

        realDrainLayer = null;

    }

    // ==========================================
    // إزالة طبقة أملاك المصارف القديمة
    // ==========================================

    if (realDrainPropertyLayer) {

        gisMap.removeLayer(
            realDrainPropertyLayer
        );

        realDrainPropertyLayer = null;

    }

    // ==========================================
    // رسم المصارف الحقيقية
    // ==========================================

    realDrainLayer =
        L.geoJSON(
            drainGeoJsonData,
            {

                style: {

                    weight: 3,

                    opacity: 0.75

                },

                onEachFeature:
                    function (
                        feature,
                        layer
                    ) {

                        const props =
                            feature.properties || {};

                        const drainId =
                            props.drainId;

                        const name =
                            props.name ||
                            'مصرف بدون اسم';

                        const lengthKm =
                            Number(
                                props.lengthKm || 0
                            ).toFixed(3);

                        const propertyCount =
                            Number(
                                props.propertyCount || 0
                            );

                        layer.bindPopup(`

                            <div
                                dir="rtl"
                                style="
                                    min-width:220px;
                                    line-height:1.8;
                                "
                            >

                                <strong>
                                    ${name}
                                </strong>

                                <br>

                                <span>
                                    ID:
                                    ${drainId}
                                </span>

                                <br>

                                <span>
                                    الطول:
                                    ${lengthKm}
                                    كم
                                </span>

                                <br>

                                <span>
                                    عدد مناطق الأملاك:
                                    ${propertyCount}
                                </span>

                                <br><br>

                                <button
                                    type="button"
                                    onclick="
                                        selectRealDrain(
                                            '${drainId}'
                                        )
                                    "
                                    style="
                                        cursor:pointer;
                                        padding:6px 12px;
                                    "
                                >
                                    اختيار المصرف
                                </button>

                            </div>

                        `);
layer.on(
    'click',
    function (event) {

        // ==========================================
        // لو وضع تحديد نقطة التحليل شغال
        // ==========================================

        if (
            satellitePointSelectionActive
        ) {

            console.log(
                '📍 Point selection click:',
                drainId
            );

            const drainFeature =
                layer.feature;

            if (
                !drainFeature ||
                !drainFeature.geometry
            ) {

                console.warn(
                    '⚠️ Drain geometry not available.'
                );

                return;
            }

            // ==========================================
            // تحويل هندسة المصرف إلى LineString
            // ==========================================

            let drainLine;

            try {

                if (
                    drainFeature.geometry.type ===
                    'LineString'
                ) {

                    drainLine =
                        turf.lineString(
                            drainFeature.geometry.coordinates
                        );

                }

                else if (
                    drainFeature.geometry.type ===
                    'MultiLineString'
                ) {

                    const lines =
                        drainFeature.geometry.coordinates
                            .map(
                                coordinates =>
                                    turf.lineString(
                                        coordinates
                                    )
                            );

                    let nearestLine = null;
                    let nearestDistance =
                        Infinity;

                    const clickPoint =
                        turf.point([
                            event.latlng.lng,
                            event.latlng.lat
                        ]);

                    lines.forEach(
                        line => {

                            const candidate =
                                turf.nearestPointOnLine(
                                    line,
                                    clickPoint,
                                    {
                                        units:
                                            'kilometers'
                                    }
                                );

                            const distance =
                                Number(
                                    candidate
                                        .properties
                                        .dist
                                );

                            if (
                                Number.isFinite(distance) &&
                                distance <
                                    nearestDistance
                            ) {

                                nearestDistance =
                                    distance;

                                nearestLine =
                                    line;
                            }

                        }
                    );

                    drainLine =
                        nearestLine;

                }

                else {

                    console.warn(
                        '⚠️ Unsupported drain geometry:',
                        drainFeature.geometry.type
                    );

                    return;
                }

            }
            catch (error) {

                console.error(
                    '❌ Failed to prepare drain line:',
                    error
                );

                return;
            }

            // ==========================================
            // نقطة الضغط
            // ==========================================

            const clickPoint =
                turf.point([
                    event.latlng.lng,
                    event.latlng.lat
                ]);

            // ==========================================
            // أقرب نقطة حقيقية على المصرف
            // ==========================================

            const nearestPoint =
                turf.nearestPointOnLine(
                    drainLine,
                    clickPoint,
                    {
                        units:
                            'kilometers'
                    }
                );

            // ==========================================
            // حساب الكيلو من بداية المصرف
            // ==========================================

            let chainageKm =
                Number(
                    nearestPoint
                        ?.properties
                        ?.location
                );

            if (
                !Number.isFinite(
                    chainageKm
                )
            ) {

                chainageKm = 0;

            }

            chainageKm =
                Number(
                    chainageKm.toFixed(2)
                );

            // ==========================================
            // حفظ نقطة التحليل
            // ==========================================

            selectedSatellitePoint = {

                lat:
                    Number(
                        nearestPoint
                            .geometry
                            .coordinates[1]
                    ),

                lng:
                    Number(
                        nearestPoint
                            .geometry
                            .coordinates[0]
                    ),

                chainageKm:
                    chainageKm

            };

            console.log(
                '✅ SELECTED SATELLITE POINT:',
                selectedSatellitePoint
            );

            // ==========================================
            // إزالة Marker القديم
            // ==========================================

            if (
                selectedSatellitePointMarker
            ) {

                gisMap.removeLayer(
                    selectedSatellitePointMarker
                );

                selectedSatellitePointMarker =
                    null;

            }

            // ==========================================
            // إنشاء Marker الجديد
            // ==========================================

            selectedSatellitePointMarker =
                L.marker(
                    [
                        selectedSatellitePoint.lat,
                        selectedSatellitePoint.lng
                    ]
                )
                .addTo(
                    gisMap
                );

            // ==========================================
            // Popup
            // ==========================================

            selectedSatellitePointMarker
                .bindPopup(
                    `
                    <div
                        dir="rtl"
                        style="
                            min-width:180px;
                            text-align:center;
                            line-height:1.8;
                        "
                    >

                        <strong>
                            📍 نقطة التحليل
                        </strong>

                        <br>

                        المصرف:
                        ${
                            drainFeature
                                .properties
                                ?.name ||
                            drainId
                        }

                        <br>

                        الكيلو:
                        <strong>
                            ${chainageKm} كم
                        </strong>

                    </div>
                    `
                )
                .openPopup();

            // ==========================================
            // إنهاء وضع اختيار النقطة
            // ==========================================

            satellitePointSelectionActive =
                false;

            satelliteAnalysisMode =
                'drain-location';

            console.log(
                '🟢 Satellite point selected successfully.'
            );

            // مهم جدًا:
            // لا نستدعي selectRealDrain هنا
            // لأنه كان يلغي وضع تحديد النقطة.

            return;
        }

        // ==========================================
        // الوضع العادي
        // ==========================================

        selectRealDrain(
            drainId
        );

    

        console.log(
            '📍 Nearest point:',
            nearestPoint
        );


        // ==========================================
        // حساب الكيلو من بداية المصرف
        // ==========================================

        let chainageKm =
            Number(
                nearestPoint
                    ?.properties
                    ?.location
            );


        if (
            !Number.isFinite(
                chainageKm
            )
        ) {

            chainageKm = 0;

        }


        chainageKm =
            Number(
                chainageKm.toFixed(2)
            );


        // ==========================================
        // حفظ نقطة التحليل
        // ==========================================

        selectedSatellitePoint = {

            lat:
                Number(
                    nearestPoint
                        .geometry
                        .coordinates[1]
                ),

            lng:
                Number(
                    nearestPoint
                        .geometry
                        .coordinates[0]
                ),

            chainageKm:
                chainageKm

        };


        console.log(
            '✅ SELECTED SATELLITE POINT:',
            selectedSatellitePoint
        );


        // ==========================================
        // حذف Marker القديم
        // ==========================================

        if (
            selectedSatellitePointMarker
        ) {

            gisMap.removeLayer(
                selectedSatellitePointMarker
            );

            selectedSatellitePointMarker =
                null;

        }


        // ==========================================
        // إنشاء Marker جديد
        // ==========================================

        selectedSatellitePointMarker =
            L.marker(
                [
                    selectedSatellitePoint.lat,
                    selectedSatellitePoint.lng
                ]
            ).addTo(
                gisMap
            );


        // ==========================================
        // Popup نقطة التحليل
        // ==========================================

        selectedSatellitePointMarker
            .bindPopup(
                `
                <div
                    dir="rtl"
                    style="
                        min-width:180px;
                        text-align:center;
                        line-height:1.8;
                    "
                >

                    <strong>
                        📍 نقطة التحليل
                    </strong>

                    <br>

                    المصرف:
                    ${
                        feature.properties?.name ||
                        drainId
                    }

                    <br>

                    الكيلو:
                    <strong>
                        ${chainageKm}
                        كم
                    </strong>

                </div>
                `
            )
            .openPopup();


        // ==========================================
        // إنهاء وضع اختيار النقطة
        // ==========================================

        satellitePointSelectionActive =
            false;

        satelliteAnalysisMode =
            'drain-location';


        console.log(
            '🟢 Satellite point selected successfully.'
        );

    }
);
                    }

            }
        );

    // ==========================================
    // إضافة طبقة المصارف للخريطة
    // ==========================================

    realDrainLayer.addTo(
        gisMap
    );

    // ==========================================
    // تجميع أملاك جميع المصارف
    // ==========================================

    const propertyFeatures = [];

    drainGeoJsonData.features.forEach(
        drainFeature => {

            const props =
                drainFeature.properties || {};

            const propertyGeometry =
                Array.isArray(
                    props.propertyGeometry
                )
                    ? props.propertyGeometry
                    : [];

            propertyGeometry.forEach(
                propertyFeature => {

                    if (
                        !propertyFeature ||
                        !propertyFeature.geometry
                    ) {

                        return;

                    }

                    propertyFeatures.push({

                        type:
                            'Feature',

                        properties: {

                            drainId:
                                props.drainId,

                            drainName:
                                props.name ||
                                'مصرف بدون اسم',

                            propertyCount:
                                props.propertyCount || 0

                        },

                        geometry:
                            propertyFeature.geometry

                    });

                }
            );

        }
    );

    // ==========================================
    // رسم أملاك المصارف الحقيقية
    // ==========================================

    if (propertyFeatures.length > 0) {

        realDrainPropertyLayer =
            L.geoJSON(
                {
                    type:
                        'FeatureCollection',

                    features:
                        propertyFeatures
                },
                {

                    style: {

                        color:
                            '#22c55e',

                        weight:
                            2,

                        opacity:
                            0.9,

                        fillColor:
                            '#22c55e',

                        fillOpacity:
                            0.12,

                        dashArray:
                            '6, 5'

                    },

                    onEachFeature:
                        function (
                            feature,
                            layer
                        ) {

                            const props =
                                feature.properties || {};

                            layer.bindPopup(`

                                <div
                                    dir="rtl"
                                    style="
                                        min-width:220px;
                                        line-height:1.8;
                                    "
                                >

                                    <strong>
                                        أملاك المصرف
                                    </strong>

                                    <br>

                                    <span>
                                        المصرف:
                                        ${
                                            props.drainName ||
                                            '-'
                                        }
                                    </span>

                                    <br>

                                    <span>
                                        ID:
                                        ${
                                            props.drainId ||
                                            '-'
                                        }
                                    </span>

                                </div>

                            `);

                        }

                }
            );

       // ==========================================
// طبقة الأملاك يتم تجهيزها فقط
// ولا تظهر على الخريطة إلا عند اختيار مصرف
// ==========================================

console.log(
    '🟢 REAL drain property layer prepared:',
    propertyFeatures.length
);

// لا نضيف الطبقة إلى الخريطة هنا
// سيتم إظهار أملاك المصرف المختار داخل selectRealDrain()
    }

    // ==========================================
    // Logs
    // ==========================================

    console.log(
        '🟢 REAL drains rendered:',
        drainGeoJsonData.features.length
    );

    console.log(
        '🟢 REAL drain property areas rendered:',
        propertyFeatures.length
    );

}



// ==================================================
// عرض بيانات المصرف الحقيقي في Sidebar
// ==================================================

function renderSelectedRealDrainDetails(feature) {

    if (!feature) {
        return;
    }

    const properties =
        feature.properties || {};

    const detailValues =
        document.querySelectorAll(
            '.detail-value'
        );

    // ------------------------------------------
    // بيانات المصرف
    // ------------------------------------------

    if (detailValues.length >= 6) {

        detailValues[0].textContent =
            properties.drainId ||
            '-';

        detailValues[1].textContent =
            properties.governorate ||
            '-';

        detailValues[2].textContent =
            properties.center ||
            '-';

        detailValues[3].textContent =
            '-';

        detailValues[4].textContent =
            '-';

        detailValues[5].textContent =
            '-';

    }

    // ------------------------------------------
    // CASE ID
    // ------------------------------------------

    const caseIdElement =
        document.querySelector(
            '.case-id'
        );

    if (caseIdElement) {

        caseIdElement.textContent =
            `DRAIN ID: ${
                properties.drainId || '-'
            }`;

    }

    // ------------------------------------------
    // العنوان
    // ------------------------------------------

    const caseTitleElement =
        document.querySelector(
            '.case-title'
        );

    if (caseTitleElement) {

        caseTitleElement.textContent =
            'بيانات المصرف الحقيقي';

    }

    // ------------------------------------------
    // Risk
    // ------------------------------------------

    const riskNumber =
        document.querySelector(
            '.risk-number'
        );

    if (riskNumber) {

        riskNumber.innerHTML = `
            -
            <span style="
                font-size:16px;
            ">
                /100
            </span>
        `;

    }

    // ------------------------------------------
    // Action
    // ------------------------------------------

    const actionElement =
        document.querySelector(
            '.action'
        );

    if (actionElement) {

        actionElement.textContent =
            'لم يتم إجراء تحليل بعد';

    }

    // ------------------------------------------
    // Analysis
    // ------------------------------------------

    const analysisElement =
        document.querySelector(
            '.analysis-content'
        );

    if (analysisElement) {

        analysisElement.innerHTML = `
            <strong>
                ${properties.name || 'مصرف بدون اسم'}
            </strong>
            <br>
            تم اختيار المصرف من قاعدة بيانات المصارف الحقيقية.
            <br><br>
            الطول:
            ${properties.lengthKm ?? '-'} كم
            <br>
            عدد النقاط:
            ${properties.pointCount ?? '-'}
            <br>
            نوع الهندسة:
            ${feature.geometry?.type ?? '-'}
        `;

    }

}




function selectRealDrain(drainId) {

    // ------------------------------------------
    // تصفير نقطة التحليل السابقة
    // عند اختيار مصرف جديد
    // ------------------------------------------

    selectedSatellitePoint = null;

    if (selectedSatellitePointMarker) {
        gisMap.removeLayer(
            selectedSatellitePointMarker
        );

        selectedSatellitePointMarker = null;
    }

    satelliteAnalysisMode =
        'drain-property';

    satellitePointSelectionActive =
        false;

    if (
        !drainGeoJsonData ||
        !drainGeoJsonData.features
    ) {

        console.warn(
            '⚠️ Drain GeoJSON data not available'
        );

        return;
    }

    // ==========================================
    // البحث عن المصرف الحقيقي
    // ==========================================

    const feature =
        drainGeoJsonData.features.find(
            f =>
                String(
                    f.properties?.drainId
                ) === String(drainId)
        );

    if (!feature) {

        console.warn(
            '⚠️ Drain not found:',
            drainId
        );

        return;
    }

    // ==========================================
    // إزالة تحديد المصرف السابق
    // ==========================================

    if (selectedRealDrainLayer) {

        selectedRealDrainLayer.setStyle({
            weight: 3,
            opacity: 0.75
        });

    }

    // ==========================================
    // إزالة تحديد أملاك المصرف السابق
    // ==========================================

    if (selectedRealDrainPropertyLayer) {

        try {

            selectedRealDrainPropertyLayer.removeFrom(
                gisMap
            );

        } catch (e) {

            console.warn(
                '⚠️ Could not remove previous property selection',
                e
            );

        }

        selectedRealDrainPropertyLayer = null;

    }

    // ==========================================
    // تحديد المصرف الجديد
    // ==========================================

    selectedRealDrain = feature;

    window.selectedRealDrain = feature;

    selectedRealDrain =
    feature;

window.selectedRealDrain =
    feature;

// عرض بيانات المصرف في Sidebar
renderSelectedRealDrainDetails(
    feature
);

    // ==========================================
    // إنشاء منطقة الدراسة الحقيقية حول المصرف
    // ==========================================

    createRealDrainAOI(feature);

    // ==========================================
    // البحث عن Layer الخاص بالمصرف
    // ==========================================

    if (realDrainLayer) {

        realDrainLayer.eachLayer(layer => {

            if (
                String(
                    layer.feature?.properties?.drainId
                ) === String(drainId)
            ) {

                selectedRealDrainLayer = layer;

                layer.setStyle({
                    weight: 8,
                    opacity: 1
                });

                layer.bringToFront();

            }

        });

    }

    // ==========================================
    // تحديد أملاك المصرف الحقيقي
    // ==========================================

    if (realDrainPropertyLayer) {

        const propertyFeatures = [];

        realDrainPropertyLayer.eachLayer(layer => {

            const layerDrainId =
                layer.feature?.properties?.drainId;

            if (
                String(layerDrainId) === String(drainId)
            ) {

                propertyFeatures.push(
                    layer.feature
                );

            }

        });

        // ==========================================
        // إنشاء Layer خاص بأملاك المصرف المختار
        // ==========================================

        if (propertyFeatures.length > 0) {

            selectedRealDrainPropertyLayer =
                L.geoJSON(
                    {
                        type: 'FeatureCollection',
                        features: propertyFeatures
                    },
                    {

                        style: {

                            color: '#00ff88',
                            weight: 3,
                            opacity: 1,
                            fillColor: '#00ff88',
                            fillOpacity: 0.28,
                            dashArray: '6,4'

                        },

                        onEachFeature: (
                            propertyFeature,
                            layer
                        ) => {

                            const p =
                                propertyFeature.properties || {};

                            layer.bindPopup(`
                                <div dir="rtl">
                                    <strong>
                                        أملاك المصرف
                                    </strong>
                                    <br>
                                    المصرف:
                                    ${p.drainName || p.name || drainId}
                                    <br>
                                    ID:
                                    ${p.drainId || drainId}
                                </div>
                            `);

                        }

                    }
                );

            selectedRealDrainPropertyLayer.addTo(
                gisMap
            );

            // ==========================================
            // وضع أملاك المصرف المختار فوق الخط
            // ==========================================

            selectedRealDrainPropertyLayer.bringToFront();

            if (selectedRealDrainLayer) {
                selectedRealDrainLayer.bringToFront();
            }

            console.log(
                '🟢 Selected property areas:',
                propertyFeatures.length
            );

        } else {

            console.warn(
                '⚠️ No real property polygons found for drain:',
                drainId
            );

        }

    }

    // ==========================================
    // بيانات المصرف الحقيقي
    // ==========================================

    const properties =
        feature.properties || {};

    const geometry =
        feature.geometry || {};

    console.log(
        '========================================'
    );

    console.log(
        '🟢 REAL DRAIN SELECTED'
    );

    console.log(
        'Drain ID:',
        properties.drainId
    );

    console.log(
        'Name:',
        properties.name
    );

    console.log(
        'Length (m):',
        properties.lengthM
    );

    console.log(
        'Length (km):',
        properties.lengthKm
    );

    console.log(
        'Point Count:',
        properties.pointCount
    );

    console.log(
        'Geometry Type:',
        geometry.type
    );

    // ==========================================
    // حساب حدود المصرف + أملاكه
    // ==========================================

    let zoomBounds = null;

    if (selectedRealDrainLayer) {

        zoomBounds =
            selectedRealDrainLayer.getBounds();

    }

    if (
        selectedRealDrainPropertyLayer &&
        selectedRealDrainPropertyLayer.getBounds().isValid()
    ) {

        const propertyBounds =
            selectedRealDrainPropertyLayer.getBounds();

        if (zoomBounds && zoomBounds.isValid()) {

            zoomBounds.extend(propertyBounds);

        } else {

            zoomBounds = propertyBounds;

        }

    }

    // ==========================================
    // Zoom على المصرف + أملاكه
    // ==========================================

    if (
        zoomBounds &&
        zoomBounds.isValid()
    ) {

        gisMap.fitBounds(
            zoomBounds,
            {
                padding: [40, 40],
                maxZoom: 22
            }
        );

    } else {

        // fallback على حدود المصرف نفسه

        try {

            const fallbackLayer =
                L.geoJSON(feature);

            if (
                fallbackLayer.getBounds().isValid()
            ) {

                gisMap.fitBounds(
                    fallbackLayer.getBounds(),
                    {
                        padding: [40, 40],
                        maxZoom: 22
                    }
                );

            }

        } catch (e) {

            console.warn(
                '⚠️ Could not zoom to selected drain:',
                e
            );

        }

    }

    // ==========================================
    // فتح Popup المصرف
    // ==========================================

    if (selectedRealDrainLayer) {

        selectedRealDrainLayer.openPopup();

    }

    console.log(
        '📍 Zoom completed on drain + real property areas'
    );

}


// ==================================================
// CREATE REAL DRAIN AOI
// ==================================================

// ==================================================
// CREATE REAL DRAIN AOI
// AOI = 50 متر حول أملاك المصرف الحقيقية
// ==================================================
// ==================================================
// CREATE REAL DRAIN AOI
// REAL PROPERTY GEOMETRY + 50m
// ==================================================

function createRealDrainAOI(feature) {

    if (!feature) {

        console.warn(
            '⚠️ Cannot create AOI: invalid drain feature'
        );

        return;
    }

    if (!gisMap) {

        console.warn(
            '⚠️ GIS map is not ready'
        );

        return;
    }

    if (
        typeof turf === 'undefined'
    ) {

        console.error(
            '❌ Turf.js is not loaded'
        );

        return;
    }

    // ==================================================
    // 1️⃣ الحصول على أملاك المصرف الحقيقية
    // ==================================================

    const propertyGeometry =
        feature.properties?.propertyGeometry;

    if (
        !Array.isArray(propertyGeometry) ||
        propertyGeometry.length === 0
    ) {

        console.warn(
            '⚠️ No property geometry found for drain:',
            feature.properties?.drainId
        );

        return;
    }

    // ==================================================
    // 2️⃣ تحويل أملاك المصرف إلى GeoJSON Features
    // ==================================================

    const propertyFeatures =
        propertyGeometry
            .filter(
                property =>
                    property &&
                    property.geometry
            )
            .map(
                property => ({

                    type:
                        'Feature',

                    properties:
                        {},

                    geometry:
                        property.geometry

                })
            );

    if (
        propertyFeatures.length === 0
    ) {

        console.warn(
            '⚠️ Drain has no valid property polygons'
        );

        return;
    }

    // ==================================================
    // 3️⃣ إنشاء FeatureCollection
    // ==================================================

    const propertyCollection =
        turf.featureCollection(
            propertyFeatures
        );

    // ==================================================
    // 4️⃣ إضافة 50 متر حول أملاك المصرف
    // ==================================================

    const bufferedProperty =
        turf.buffer(
            propertyCollection,
            50,
            {
                units:
                    'meters'
            }
        );

    if (!bufferedProperty) {

        console.warn(
            '⚠️ Failed to create 50m property buffer'
        );

        return;
    }

    // ==================================================
    // 5️⃣ حذف AOI القديم
    // ==================================================

    if (drainAOILayer) {

        gisMap.removeLayer(
            drainAOILayer
        );

        drainAOILayer = null;
    }

    // ==================================================
    // 6️⃣ رسم أملاك المصرف + 50 متر
    // ==================================================

    drainAOILayer =
        L.geoJSON(
            bufferedProperty,
            {

                style: {

                    color:
                        '#00e5ff',

                    weight:
                        2,

                    opacity:
                        0.9,

                    fillColor:
                        '#00e5ff',

                    fillOpacity:
                        0.08,

                    dashArray:
                        '8, 6'

                }

            }
        );

    drainAOILayer.addTo(
        gisMap
    );

    // ==================================================
    // 7️⃣ الحصول على حدود AOI
    // ==================================================

    const leafletBounds =
        drainAOILayer.getBounds();

    if (
        !leafletBounds.isValid()
    ) {

        console.warn(
            '⚠️ Invalid AOI bounds'
        );

        return;
    }

    const southWest =
        leafletBounds.getSouthWest();

    const northEast =
        leafletBounds.getNorthEast();

    const minLat =
        southWest.lat;

    const maxLat =
        northEast.lat;

    const minLng =
        southWest.lng;

    const maxLng =
        northEast.lng;

    // ==================================================
    // 8️⃣ حفظ AOI الحقيقي
    // ==================================================

    const aoiData = {

        drainId:
            feature.properties?.drainId,

        minLat,

        maxLat,

        minLng,

        maxLng,

        bounds:
            leafletBounds,

        // هذه أهم قيمة
        // لأنها تمثل أملاك المصرف + 50m

        geometry:
            bufferedProperty,

        bufferMeters:
            50,

        basedOn:
            'drain-property'

    };

    window.selectedDrainAOI =
        aoiData;

    // ==================================================
    // 9️⃣ Popup
    // ==================================================

    drainAOILayer.bindPopup(

        `
        <div style="direction:rtl;text-align:right">

            <strong>
                🛰️ منطقة الدراسة
            </strong>

            <hr>

            <div>
                المصرف:
                <strong>
                    ${aoiData.drainId || '-'}
                </strong>
            </div>

            <div style="margin-top:6px">

                مصدر منطقة التحليل:
                <strong>
                    أملاك المصرف
                </strong>

            </div>

            <div style="margin-top:6px">

                نطاق التوسعة:
                <strong>
                    +50 متر
                </strong>

            </div>

            <div style="margin-top:8px;color:#00a6c7">

                Sentinel-2 AOI

            </div>

        </div>
        `

    );

    // ==================================================
    // 🔟 Console
    // ==================================================

    console.log(
        '========================================'
    );

    console.log(
        '🛰️ REAL PROPERTY AOI + 50m CREATED'
    );

    console.log(
        'Drain ID:',
        aoiData.drainId
    );

    console.log(
        'Property Features:',
        propertyFeatures.length
    );

    console.log(
        'Buffer:',
        '50 meters'
    );

    console.log(
        'AOI Bounds:',
        leafletBounds
    );

    console.log(
        'AOI Geometry:',
        bufferedProperty
    );

    console.log(
        '========================================'
    );

}
// ==================================================
// SPATIAL INTELLIGENCE
// Distance + Nearest Point on Drain
// ==================================================

function getDistanceMeters(lat1, lng1, lat2, lng2) {

    const R = 6371000;

    const toRad = deg =>
        deg * Math.PI / 180;

    const dLat =
        toRad(lat2 - lat1);

    const dLng =
        toRad(lng2 - lng1);

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) ** 2;

    const c =
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );

    return R * c;
}


// ==================================================
// NEAREST POINT ON SEGMENT
// ==================================================

function getNearestPointOnSegment(
    p,
    a,
    b
) {

    const latScale =
        111320;

    const lngScale =
        111320 *
        Math.cos(
            p.lat * Math.PI / 180
        );

    const ax = a.lng * lngScale;
    const ay = a.lat * latScale;

    const bx = b.lng * lngScale;
    const by = b.lat * latScale;

    const px = p.lng * lngScale;
    const py = p.lat * latScale;

    const dx = bx - ax;
    const dy = by - ay;

    const lengthSquared =
        dx * dx +
        dy * dy;

    let t = 0;

    if (lengthSquared > 0) {

        t =
            (
                (px - ax) * dx +
                (py - ay) * dy
            ) /
            lengthSquared;

        t =
            Math.max(
                0,
                Math.min(1, t)
            );
    }

    const nearestX =
        ax + t * dx;

    const nearestY =
        ay + t * dy;

    return {
        lat: nearestY / latScale,
        lng: nearestX / lngScale
    };
}


// ==================================================
// CASE → DRAIN SPATIAL RELATION
// ==================================================

function analyzeCaseDrainSpatialRelation(
    currentCase,
    drainFeature
) {

    if (
        !currentCase ||
        !currentCase.coordinates ||
        !drainFeature ||
        !drainFeature.geometry
    ) {
        return null;
    }

    const caseLat =
        Number(
            currentCase.coordinates.lat
        );

    const caseLng =
        Number(
            currentCase.coordinates.lng
        );

    if (
        !Number.isFinite(caseLat) ||
        !Number.isFinite(caseLng)
    ) {
        return null;
    }

    const geometry =
        drainFeature.geometry;

    let lines = [];

    if (
        geometry.type === 'LineString'
    ) {

        lines = [
            geometry.coordinates
        ];

    } else if (
        geometry.type === 'MultiLineString'
    ) {

        lines =
            geometry.coordinates;

    } else {

        console.warn(
            '⚠️ Unsupported drain geometry:',
            geometry.type
        );

        return null;
    }

    let bestDistance =
        Infinity;

    let bestPoint =
        null;

    const casePoint = {
        lat: caseLat,
        lng: caseLng
    };

    for (
        const line of lines
    ) {

        if (
            !Array.isArray(line) ||
            line.length < 2
        ) {
            continue;
        }

        for (
            let i = 0;
            i < line.length - 1;
            i++
        ) {

            const start = {
                lng: Number(line[i][0]),
                lat: Number(line[i][1])
            };

            const end = {
                lng: Number(line[i + 1][0]),
                lat: Number(line[i + 1][1])
            };

            const nearest =
                getNearestPointOnSegment(
                    casePoint,
                    start,
                    end
                );

            const distance =
                getDistanceMeters(
                    caseLat,
                    caseLng,
                    nearest.lat,
                    nearest.lng
                );

            if (
                distance < bestDistance
            ) {

                bestDistance =
                    distance;

                bestPoint =
                    nearest;
            }
        }
    }

    if (
        !bestPoint ||
        !Number.isFinite(bestDistance)
    ) {
        return null;
    }

    let proximity;

    if (bestDistance <= 25) {

        proximity = 'near';

    } else if (bestDistance <= 75) {

        proximity = 'moderate';

    } else {

        proximity = 'far';
    }

    return {

        distanceToDrain:
            Number(
                bestDistance.toFixed(1)
            ),

        proximity,

        nearestPoint: {

            lat:
                Number(
                    bestPoint.lat.toFixed(6)
                ),

            lng:
                Number(
                    bestPoint.lng.toFixed(6)
                )
        }
    };
}


// ==================================================
// SPATIAL PROXIMITY INFO
// ==================================================

function getSpatialProximityInfo(
    proximity
) {

    switch (proximity) {

        case 'near':

            return {
                label: 'قريب من المصرف',
                icon: '🟢',
                color: '#22c55e'
            };

        case 'moderate':

            return {
                label: 'متوسط القرب من المصرف',
                icon: '🟡',
                color: '#f59e0b'
            };

        case 'far':

            return {
                label: 'بعيد عن المصرف',
                icon: '🔵',
                color: '#3b82f6'
            };

        default:

            return {
                label: 'غير محدد',
                icon: '⚪',
                color: '#94a3b8'
            };
    }
}


// ==================================================
// DRAIN BUFFER ANALYSIS
// ==================================================

function createDrainBufferAnalysis(
    drainFeature,
    bufferMeters = 50
) {

    if (
        !drainFeature ||
        !drainFeature.geometry
    ) {
        return null;
    }

    if (
        typeof turf === 'undefined'
    ) {
        console.error(
            '❌ Turf.js is not loaded'
        );

        return null;
    }

    try {

        const buffered =
            turf.buffer(
                drainFeature,
                bufferMeters,
                {
                    units: 'meters'
                }
            );

        return {
            bufferFeature: buffered,
            bufferMeters
        };

    } catch (error) {

        console.error(
            '❌ Drain buffer analysis failed:',
            error
        );

        return null;
    }
}


// ==================================================
// CHANGE ↔ DRAIN BUFFER ANALYSIS
// ==================================================

// ==================================================
// CHANGE ↔ REAL DRAIN PROPERTY AOI + 50m
// ==================================================

function analyzeChangeAgainstDrainBuffer(
    currentCase,
    drainFeature,
    bufferMeters = 50
) {

    if (
        !currentCase ||
        typeof turf === 'undefined'
    ) {
        return null;
    }

    const lat =
        Number(
            currentCase.coordinates?.lat
        );

    const lng =
        Number(
            currentCase.coordinates?.lng
        );

    const changeArea =
        Math.max(
            0,
            Number(
                currentCase.detection?.changeArea
            ) || 0
        );

    if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
    ) {
        return null;
    }

    if (changeArea <= 0) {
        return null;
    }

    try {

        // ==========================================
        // 1. Case Point
        // ==========================================

        const casePoint =
            turf.point([
                lng,
                lat
            ]);


        // ==========================================
        // 2. REAL PROPERTY AOI
        //    الأولوية للـ AOI الحقيقي المختار
        // ==========================================

        let analysisAOI =
            window.selectedDrainAOI?.geometry ||
            null;


        // ==========================================
        // 3. Fallback فقط للحالات التجريبية
        // ==========================================

        if (
            !analysisAOI &&
            drainFeature &&
            !realGISMode
        ) {

            analysisAOI =
                turf.buffer(
                    drainFeature,
                    bufferMeters,
                    {
                        units: 'meters'
                    }
                );
        }


        if (!analysisAOI) {

            console.warn(
                '⚠️ No real property AOI available for Change ↔ Drain analysis'
            );

            return null;
        }


        // ==========================================
        // 4. التأكد من أن AOI قابلة للاستخدام
        // ==========================================

        let analysisFeature =
            analysisAOI;


        if (
            analysisAOI.type ===
            'FeatureCollection'
        ) {

            if (
                !Array.isArray(
                    analysisAOI.features
                ) ||
                analysisAOI.features.length === 0
            ) {
                return null;
            }

            /*
             * دمج قطع أملاك المصرف في هندسة واحدة
             * حتى يعمل intersection / point-in-polygon
             */

            analysisFeature =
                turf.union(
                    analysisAOI
                );

        }


        if (
            !analysisFeature ||
            !analysisFeature.geometry
        ) {

            console.warn(
                '⚠️ Failed to build real property analysis AOI'
            );

            return null;
        }


        // ==========================================
        // 5. هل مركز الحالة داخل أملاك المصرف +50م؟
        // ==========================================

        const centerInside =
            turf.booleanPointInPolygon(
                casePoint,
                analysisFeature
            );


        // ==========================================
        // 6. إنشاء Change Polygon مؤقت
        // ==========================================

        const estimatedRadius =
            Math.sqrt(
                changeArea /
                Math.PI
            );


        const changePolygon =
            turf.circle(
                [
                    lng,
                    lat
                ],
                estimatedRadius / 1000,
                {
                    steps: 64,
                    units: 'kilometers'
                }
            );


        // ==========================================
        // 7. Intersection
        // ==========================================

        let overlapArea = 0;

        try {

            const intersection =
                turf.intersect(
                    turf.featureCollection([
                        changePolygon,
                        analysisFeature
                    ])
                );

            if (intersection) {

                overlapArea =
                    turf.area(
                        intersection
                    );

            }

        } catch (error) {

            console.warn(
                '⚠️ Change/Property AOI intersection failed:',
                error
            );

        }


        // ==========================================
        // 8. نسبة التداخل
        // ==========================================

        const overlapPercentage =
            changeArea > 0
                ? (
                    overlapArea /
                    changeArea
                ) * 100
                : 0;


        // ==========================================
        // 9. Classification
        // ==========================================

        let relation =
            'outside';


        if (
            overlapPercentage >= 50
        ) {

            relation =
                'high_overlap';

        }
        else if (
            overlapPercentage > 0
        ) {

            relation =
                'partial_overlap';

        }
        else if (
            centerInside
        ) {

            relation =
                'inside';
        }


        // ==========================================
        // 10. Return
        // ==========================================

        return {

            drainId:
                currentCase.drainId ||
                window.selectedDrainAOI?.drainId ||
                null,

            bufferMeters:
                window.selectedDrainAOI?.bufferMeters ||
                bufferMeters,

            basedOn:
                window.selectedDrainAOI?.basedOn ||
                'drain-property',

            changeArea,

            overlapArea:
                Number(
                    overlapArea.toFixed(2)
                ),

            overlapPercentage:
                Number(
                    overlapPercentage.toFixed(2)
                ),

            relation,

            centerInside,

            aoiType:
                analysisFeature.geometry.type
        };


    } catch (error) {

        console.error(
            '❌ Real property Change ↔ Drain analysis failed:',
            error
        );

        return null;
    }
}

function calculateEngineeringRisk(
    currentCase,
    spatialAnalysis,
    changeDrainAnalysis,
    satelliteChangeDetection
) {
        if (!currentCase) {
        return null;
    }

    // ==================================================
    // 1. AI EVIDENCE
    // ==================================================

    const aiRisk =
        Number(
            currentCase.ai?.riskScore
        ) || 0;

    const aiConfidence =
    Number(
        currentCase.ai?.confidence
    ) ||
    Number(
        currentCase.detection?.confidenceScore
    ) ||
    0;


    const changePercentage =
        Number(
            currentCase.detection?.changePercentage
        ) || 0;

    const changeArea =
        Number(
            currentCase.detection?.changeArea
        ) || 0;


    // ==================================================
    // 2. GIS EVIDENCE
    // ==================================================

    const distanceToDrain =
        Number(
            spatialAnalysis?.distanceToDrain
        );

    const overlapPercentage =
        Number(
            changeDrainAnalysis?.overlapPercentage
        ) || 0;

    const relation =
        changeDrainAnalysis?.relation ||
        'outside';


   const satelliteChangePercentage =
    Number(
        satelliteChangeDetection?.changePercentage ??
        window.latestSatelliteChangeDetection?.changePercentage
    ) || 0;

const satelliteChangedAreaM2 =
    Number(
        satelliteChangeDetection?.changedAreaM2
    ) || 0;

const satelliteMeanDeltaNDVI =
    Number(
        satelliteChangeDetection?.meanDeltaNDVI
    ) || 0;

    const satelliteEvidenceScore =
    satelliteChangePercentage >= 20
        ? 15
        : satelliteChangePercentage >= 10
            ? 10
            : satelliteChangePercentage > 0
                ? 5
                : 0;

    console.log(
    '🛰️ SATELLITE DATA INSIDE RISK ENGINE:',
    {
        satelliteChangeDetection,
        satelliteChangePercentage,
        satelliteChangedAreaM2,
        satelliteMeanDeltaNDVI
    }
);

    // ==================================================
    // 3. START RISK CALCULATION
    // ==================================================

    let riskScore = 0;


    // ==================================================
    // 4. AI RISK CONTRIBUTION
    // Maximum = 30 points
    // ==================================================

    const aiRiskContribution =
        (aiRisk / 100) * 30;

    riskScore +=
        aiRiskContribution;


    // ==================================================
    // 5. CHANGE PERCENTAGE
    // Maximum = 20 points
    // ==================================================

    if (changePercentage >= 20) {

        riskScore += 20;

    } else if (changePercentage >= 10) {

        riskScore += 15;

    } else if (changePercentage > 0) {

        riskScore += 8;
    }


    // ==================================================
    // 6. CHANGE AREA
    // Maximum = 15 points
    // ==================================================

    if (changeArea >= 500) {

        riskScore += 15;

    } else if (changeArea >= 250) {

        riskScore += 10;

    } else if (changeArea > 0) {

        riskScore += 5;
    }


// ==================================================
// 7. DISTANCE TO DRAIN
// ==================================================
// المسافة من مركز الـ AOI ليست مسافة حقيقية لمنطقة التغيير.
// لذلك لا تدخل في Risk للحالات الناتجة من Satellite Analysis.

if (
    currentCase?.source !== 'real_drain_satellite' &&
    Number.isFinite(distanceToDrain)
) {

    if (distanceToDrain <= 25) {

        riskScore += 20;

    } else if (distanceToDrain <= 75) {

        riskScore += 15;

    } else if (distanceToDrain <= 150) {

        riskScore += 8;
    }
}



    // ==================================================
    // 8. BUFFER / OVERLAP
    // Maximum = 15 points
    // ==================================================

    if (relation === 'high_overlap') {

        riskScore += 15;

    } else if (relation === 'partial_overlap') {

        riskScore += 10;

    } else if (relation === 'inside') {

        riskScore += 8;
    }


    // ==================================================
    // 9. CONFIDENCE MODIFIER
    // ==================================================

    if (aiConfidence >= 90) {
    riskScore += 3;
} else if (aiConfidence >= 75) {
    riskScore += 2;
}


if (satelliteChangedAreaM2 >= 50000) {
    riskScore += 10;
}
console.log(
    '🧮 RISK CALCULATION INPUTS:',
    {
        aiRisk,
        aiRiskContribution,
        aiConfidence,
        changePercentage,
        changeArea,
        distanceToDrain,
        overlapPercentage,
        relation,
        satelliteChangePercentage,
        satelliteChangedAreaM2,
        satelliteMeanDeltaNDVI,
        rawRiskScore: riskScore
    }
);

    // ==================================================
    // 10. KEEP SCORE BETWEEN 0–100
    // ==================================================

    riskScore =
        Math.max(
            0,
            Math.min(
                100,
                Math.round(riskScore)
            )
        );


    // ==================================================
    // 11. ENGINEERING ACTION
    // ==================================================

    let action = 'monitor';

    if (riskScore >= 70) {

        action =
            'urgent_inspection';

    } else if (riskScore >= 40) {

        action =
            'inspection';
    }


    // ==================================================
    // 12. RETURN ENGINEERING DECISION
    // ==================================================

    console.log(
    '🔬 FINAL ENGINEERING EVIDENCE:',
    {
        satelliteChangePercentage,
        satelliteChangedAreaM2,
        satelliteMeanDeltaNDVI,
        satelliteEvidenceScore
    }
);

    return {

        riskScore,

        action,

       evidence: {
    aiRisk,
    aiRiskContribution,
    aiConfidence,

    changePercentage,
    changeArea,

    distanceToDrain,
    overlapPercentage,
    relation,

    satelliteChangePercentage,
    satelliteChangedAreaM2,
    satelliteMeanDeltaNDVI,
    satelliteEvidenceScore
}
    };
}

function calculateFinalDecision(
    engineeringRisk
) {

    if (!engineeringRisk) {
        return null;
    }

    const riskScore =
        Number(
            engineeringRisk.riskScore
        ) || 0;

    let action = 'monitor';

    if (riskScore >= 70) {

        action =
            'urgent_inspection';

    } else if (riskScore >= 40) {

        action =
            'inspection';
    }

    return {
        riskScore,
        action
    };
}




function updateDrainImpactPanel(
    currentCase,
    analysis
) {

    console.log(
        '🟢 PANEL UPDATE CALLED',
        {
            caseId: currentCase?.caseId,
            analysis
        }
    );

    const distanceElement =
        document.getElementById(
            'drainDistanceValue'
        );

    const bufferElement =
        document.getElementById(
            'drainBufferValue'
        );

    const changeAreaElement =
        document.getElementById(
            'drainChangeAreaValue'
        );

    const overlapElement =
        document.getElementById(
            'drainOverlapValue'
        );

    const relationElement =
        document.getElementById(
            'drainRelationValue'
        );

    console.log(
        '🔎 PANEL ELEMENTS:',
        {
            distance: !!distanceElement,
            buffer: !!bufferElement,
            changeArea: !!changeAreaElement,
            overlap: !!overlapElement,
            relation: !!relationElement
        }
    );

console.log(
    '📋 PANEL VALUES:',
    {
        distance: distanceElement?.textContent,
        buffer: bufferElement?.textContent,
        changeArea: changeAreaElement?.textContent,
        overlap: overlapElement?.textContent,
        relation: relationElement?.textContent
    }
);


    if (!distanceElement ||
        !bufferElement ||
        !changeAreaElement ||
        !overlapElement ||
        !relationElement) {

        console.warn(
            '⚠️ Drain impact panel elements not found'
        );

        return;
    }


    if (!analysis) {

        distanceElement.textContent =
            '—';

        bufferElement.textContent =
            '—';

        changeAreaElement.textContent =
            '—';

        overlapElement.textContent =
            '—';

        relationElement.textContent =
            'لا تتوفر بيانات تحليل المصرف';

        return;
    }


    const spatial =
        currentCase?.spatial;


    const distance =
        Number(
            spatial?.distanceToDrain
        );


    distanceElement.textContent =
        Number.isFinite(distance)
            ? `${distance.toFixed(1)} م`
            : '—';


    bufferElement.textContent =
        `${analysis.bufferMeters} م`;


    changeAreaElement.textContent =
        `${analysis.changeArea} م²`;


    overlapElement.textContent =
        `${analysis.overlapPercentage}%`;


    const relationMap = {

        high_overlap:
            '🔴 تداخل مرتفع مع نطاق المصرف',

        partial_overlap:
            '🟠 يوجد تداخل جزئي مع نطاق المصرف',

        inside:
            '🟡 نقطة الحالة داخل نطاق المصرف',

        outside:
            '🟢 الحالة خارج نطاق المصرف'

    };


    relationElement.textContent =
        relationMap[
            analysis.relation
        ] ||
        'تم تحليل العلاقة المكانية';

        console.log(
    '✅ PANEL FINAL VALUES:',
    {
        distance: distanceElement.textContent.trim(),
        buffer: bufferElement.textContent.trim(),
        changeArea: changeAreaElement.textContent.trim(),
        overlap: overlapElement.textContent.trim(),
        relation: relationElement.textContent.trim()
    }
);

}



function updateGISMarker(currentCase) {

    console.log(
        '🗺️ Updating GIS...'
    );

    if (!gisMap) {

        console.error(
            '❌ GIS map is not initialized yet.'
        );

        return;

    }

    if (!currentCase) {

        console.warn(
            '⚠️ No current case available.'
        );

        return;

    }

    const coordinates =
        currentCase.coordinates || {};

    const lat =
        Number(coordinates.lat);

    const lng =
        Number(coordinates.lng);

    console.log(
        '📍 Case Coordinates:',
        {
            lat,
            lng
        }
    );

    if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
    ) {

        console.error(
            '❌ Invalid case coordinates:',
            coordinates
        );

        return;

    }


    console.log('🚨 CASE LOCATION USED:', {
    lat,
    lng,
    drainId: currentCase.drainId
});

console.log('🚨 MAP LAYERS BEFORE DRAW:', gisMap._layers);

    // ==================================================
    // إزالة عناصر GIS القديمة
    // ==================================================

    if (caseMarker) {

        gisMap.removeLayer(
            caseMarker
        );

        caseMarker = null;

    }

    if (changeZone) {

        gisMap.removeLayer(
            changeZone
        );

        changeZone = null;

    }

    if (drainLine) {

        gisMap.removeLayer(
            drainLine
        );

        drainLine = null;

    }

    if (nearestPointMarker) {
    gisMap.removeLayer(nearestPointMarker);
    nearestPointMarker = null;
}


if (caseToDrainLine) {
    gisMap.removeLayer(caseToDrainLine);
    caseToDrainLine = null;
}

   const ai = 
    currentCase.ai || {}; 

const detection = 
    currentCase.detection || {}; 

const decision = 
    currentCase.decision || {};

const riskScore =
    Number(
        currentCase.engineeringRisk?.riskScore
    ) ||
    Number(ai.riskScore) ||
    0;

const risk =
    getRiskLevel(
        riskScore
    );

    



   // ==================================================
// REAL DRAIN FROM GEOJSON
// ==================================================


const selectedDrainFeature =
    window.selectedRealDrain || null;

const drainFeature =
    selectedDrainFeature ||
    drainGeoJsonData?.features?.find(
        feature =>
            String(
                feature?.properties?.drainId || ''
            ) === String(
                currentCase.drainId || ''
            )
    );


    // ==================================================
// REAL GIS MODE
// لو عندنا المصارف الحقيقية، لا ترسم المصرف الوهمي
// ==================================================

const realGISMode =
    Array.isArray(
        drainGeoJsonData?.features
    ) &&
    drainGeoJsonData.features.length > 0;

console.log(
    '🗺️ GIS MODE:',
    {
        realGISMode,
        realDrains:
            drainGeoJsonData?.features?.length || 0,
        selectedRealDrain:
            window.selectedRealDrain
                ?.properties
                ?.drainId || null
    }
);


console.log(
    '🔍 ALL GEOJSON LAYERS:',
    Object.values(gisMap._layers)
        .map(layer => ({
            leafletType:
                layer.constructor?.name,

            isRealDrainLayer:
                layer === realDrainLayer,

            isDrainLine:
                layer === drainLine,

            isBuffer:
                layer === drainBufferLayer,

            featureType:
                layer.feature?.geometry?.type,

            drainId:
                layer.feature?.properties?.drainId,

            drainName:
                layer.feature?.properties?.name
        }))
        .filter(
            item =>
                item.featureType ||
                item.isRealDrainLayer ||
                item.isDrainLine ||
                item.isBuffer
        )
);


    // ==================================================
// SPATIAL INTELLIGENCE
// ==================================================

const spatialAnalysis =
    analyzeCaseDrainSpatialRelation(
        currentCase,
        drainFeature
    );


const spatialInfo =
    spatialAnalysis
        ? getSpatialProximityInfo(
            spatialAnalysis.proximity
        )
        : null;


        // ==================================================
// NEAREST POINT ON DRAIN
// ==================================================

if (
    spatialAnalysis &&
    spatialAnalysis.nearestPoint
) {

    const nearest =
        spatialAnalysis.nearestPoint;

    nearestPointMarker =
        L.circleMarker(
            [
                nearest.lat,
                nearest.lng
            ],
            {
                radius: 6,

                color: '#ffffff',

                weight: 3,

                fillColor: '#28b9d7',

                fillOpacity: 1,

                interactive: false
            }
        ).addTo(gisMap);

    console.log(
        '📍 Nearest drain point:',
        nearest
    );
}


// ==================================================
// CASE → NEAREST DRAIN POINT
// ==================================================

if (
    spatialAnalysis &&
    spatialAnalysis.nearestPoint
) {

    const nearest =
        spatialAnalysis.nearestPoint;

    caseToDrainLine =
        L.polyline(
            [
                [
                    currentCase.coordinates.lat,
                    currentCase.coordinates.lng
                ],
                [
                    nearest.lat,
                    nearest.lng
                ]
            ],
            {
                color: '#28b9d7',
                weight: 3,
                opacity: 0.85,
                dashArray: '8, 8',
                interactive: false
            }
        ).addTo(gisMap);

        caseToDrainLine.bindTooltip(
    `📏 ${spatialAnalysis.distanceToDrain} m`,
    {
        permanent: true,
        direction: 'center',
        className: 'distance-tooltip'
    }
);

    console.log(
        '📏 Case → Drain distance:',
        spatialAnalysis.distanceToDrain,
        'meters'
    );
}

if (spatialAnalysis) {

    currentCase.spatial =
        spatialAnalysis;

    const spatialInfo =
        getSpatialProximityInfo(
            spatialAnalysis.proximity
        );

    console.log(
        '🧠 Spatial Intelligence:',
        {

            caseId:
                currentCase.caseId,

            drainId:
                currentCase.drainId,

            distanceToDrain:
                spatialAnalysis.distanceToDrain,

            proximity:
                spatialAnalysis.proximity,

            nearestPoint:
                spatialAnalysis.nearestPoint

        }
    );

} else {

    console.warn(
        '⚠️ Spatial analysis unavailable'
    );

}


console.log(
    '🟣 REACHED V2 SECTION',
    {
        caseId: currentCase?.caseId,
        drainId: currentCase?.drainId,
        drainFeatureFound: !!drainFeature
    }
);

// ==================================================
// SPATIAL INTELLIGENCE V2
// CHANGE ↔ DRAIN BUFFER
// ==================================================

// ==================================================
// REAL PROPERTY AOI → CHANGE ANALYSIS
// ==================================================

const activeDrainFeature =
    window.selectedRealDrain ||
    (
        !realGISMode
            ? drainFeature
            : null
    );

const changeDrainAnalysis =
    analyzeChangeAgainstDrainBuffer(
        currentCase,
        activeDrainFeature,
        50
    );

console.log(
    '🟢 CHANGE ANALYSIS AOI:',
    {
        drainId:
            changeDrainAnalysis?.drainId,

        basedOn:
            changeDrainAnalysis?.basedOn,

        bufferMeters:
            changeDrainAnalysis?.bufferMeters,

        aoiType:
            changeDrainAnalysis?.aoiType,

        overlapPercentage:
            changeDrainAnalysis?.overlapPercentage,

        relation:
            changeDrainAnalysis?.relation
    }
);


console.log(
    '🔗 ACTIVE DRAIN FOR ANALYSIS:',
    {
        mode:
            realGISMode
                ? 'REAL'
                : 'TEST',

        drainId:
            activeDrainFeature
                ?.properties
                ?.drainId || null,

        drainName:
            activeDrainFeature
                ?.properties
                ?.name || null
    }
);

    console.log(
    '🧪 V2 TEST:',
    changeDrainAnalysis
);

if (changeDrainAnalysis) {

    currentCase.changeDrainAnalysis =
        changeDrainAnalysis;

    console.log(
        '🧠 Change ↔ Drain Analysis:',
        changeDrainAnalysis
    );

    updateDrainImpactPanel(
        currentCase,
        changeDrainAnalysis
    );


  console.log(
    '🛰️ SATELLITE DATA BEFORE RISK ENGINE:',
    {
        currentCaseId: currentCase.caseId,
        satelliteChangeDetection:
            currentCase.satelliteChangeDetection,
        globalSatelliteChangeDetection:
            window.latestSatelliteChangeDetection
    }
);

console.log(
    '🔎 SATELLITE VALUES BEFORE RISK:',
    {
        changePercentage:
            currentCase.satelliteChangeDetection?.changePercentage,
        changedAreaM2:
            currentCase.satelliteChangeDetection?.changedAreaM2,
        meanDeltaNDVI:
            currentCase.satelliteChangeDetection?.meanDeltaNDVI
    }
);

const satelliteDataForRisk =
    currentCase.satelliteChangeDetection ||
    window.latestSatelliteChangeDetection ||
    null;

console.log(
    '🔴🔴 SATELLITE DATA PASSED TO RISK ENGINE:',
    {
        satelliteDataForRisk,
        changePercentage:
            satelliteDataForRisk?.changePercentage,
        changedAreaM2:
            satelliteDataForRisk?.changedAreaM2,
        meanDeltaNDVI:
            satelliteDataForRisk?.meanDeltaNDVI
    }
);

const engineeringRisk =
    calculateEngineeringRisk(
        currentCase,
        spatialAnalysis,
        changeDrainAnalysis,
        satelliteDataForRisk
    );

      console.log(
        '🚨 Engineering Risk Decision:',
        engineeringRisk
    );

    if (engineeringRisk) {

    // ==========================================
    // ENGINEERING RISK
    // ==========================================

    currentCase.engineeringRisk =
        engineeringRisk;


    // ==========================================
    // FINAL DECISION
    // ==========================================

    const finalDecision =
        calculateFinalDecision(
            engineeringRisk
        );



    console.log(
        '🎯 Final Decision Layer:',
        finalDecision
    );


    if (finalDecision) {

        currentCase.finalDecision =
            finalDecision;

            finalDecision.reason =
    generateEngineeringDecisionReason(
        engineeringRisk
    );

        currentCase.risk =
            finalDecision.riskScore;

        currentCase.action =
            finalDecision.action;

            currentCase.reason =
    finalDecision.reason;

    }

const analysisElement = document.querySelector('.analysis-content');


if (analysisElement) {

    // ==========================================
    // ENGINEERING DECISION
    // ==========================================

    const action =
        finalDecision?.action ||
        'monitor';

    const actionConfig = {

        monitor: {
            label: '🟢 القرار الهندسي: متابعة',
            color: '#5de08b',
            background: '#103526',
            border: '#2f9d68'
        },

        inspection: {
            label: '🟠 القرار الهندسي: معاينة ميدانية',
            color: '#ffb45c',
            background: '#3a2915',
            border: '#b56b20'
        },

        urgent_inspection: {
            label: '🔴 القرار الهندسي: معاينة عاجلة',
            color: '#ff6b6b',
            background: '#3a1717',
            border: '#b83c3c'
        }

    };

    const config =
        actionConfig[action] ||
        actionConfig.monitor;


    // ==========================================
    // IRRIGATION AI
    // ==========================================

    const irrigationAI =
        currentCase?.irrigationAI || null;

    const aiAction =
        irrigationAI?.action ||
        'monitor';

    const aiActions = {

        request_measurement:
            '📐 طلب قياس ميداني',

        request_field_inspection:
            '👷 طلب معاينة ميدانية',

        request_satellite_analysis:
            '🛰️ طلب تحليل فضائي إضافي',

        monitor:
            '👁️ متابعة',

        escalate:
            '🚨 تصعيد الحالة'

    };

    const aiRecommendation =
        aiActions[aiAction] ||
        '👁️ متابعة';


    // ==========================================
    // AI REASON
    // ==========================================

    const aiReasons = {

        request_measurement:
            'يوصي الذكاء الاصطناعي بجمع قياس ميداني إضافي لأن الأدلة الحالية تحتاج إلى مزيد من التحقق قبل اتخاذ إجراء أعلى.',

        request_field_inspection:
            'يوصي الذكاء الاصطناعي بالتحقق المباشر من الحالة على الطبيعة، نظرًا إلى أن البيانات الحالية لا تكفي وحدها لحسم الحالة.',

        request_satellite_analysis:
            'يوصي الذكاء الاصطناعي بإجراء تحليل فضائي إضافي للحصول على أدلة أكثر قبل الانتقال إلى قرار هندسي أعلى.',

        monitor:
            'يرى الذكاء الاصطناعي أن الأدلة والمخاطر الحالية تسمح بالمتابعة دون الحاجة إلى تصعيد فوري.',

        escalate:
            'يوصي الذكاء الاصطناعي بتصعيد الحالة لمزيد من المراجعة الهندسية واتخاذ الإجراء المناسب.'

    };

    const aiReason =
        aiReasons[aiAction] ||
        'تم اختيار هذا الإجراء لدعم عملية جمع الأدلة وتحسين القرار الهندسي.';


    // ==========================================
    // SATELLITE DATA
    // ==========================================

    const satellite =
        currentCase?.satelliteChangeDetection ||
        {};


        console.log(
    '🛰️ SATELLITE FULL DATA:',
    JSON.stringify(satellite, null, 2)
);

    const satelliteChange =
        Number(
            satellite?.changePercentage ??
            0
        );

    const changedArea =
        Number(
            satellite?.changedAreaM2 ??
            0
        );

    const waterDetected =
        satellite?.waterHyacinth?.detected === true;


    // ==========================================
    // OVERLAP
    // ==========================================

    const overlap =
        Number(
            currentCase?.changeDrainAnalysis?.overlapPercentage ??
            0
        );


    // ==========================================
    // ENGINEERING RISK
    // ==========================================

    const riskScore =
        Number(
            currentCase?.engineeringRisk?.riskScore ??
            currentCase?.risk ??
            0
        );


    // ==========================================
    // DASHBOARD CARD
    // ==========================================

    analysisElement.innerHTML = `

        <div
            style="
                width:100%;
                box-sizing:border-box;
                color:#ffffff;
                font-family:
                    'Segoe UI',
                    Tahoma,
                    Arial,
                    sans-serif;
                direction:rtl;
                overflow:visible;
            "
        >

            <!-- ==================================
                 ENGINEERING HEADER
            ================================== -->

            <div
                style="
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    margin-bottom:22px;
                "
            >

                <div
                    style="
                        display:inline-block;
                        padding:16px 28px;

                        border:
                            1px solid
                            ${config.border};

                        border-radius:12px;

                        background:
                            ${config.background};

                        color:
                            ${config.color};

                        font-size:26px;
                        font-weight:900;

                        line-height:1.6;

                        text-align:center;

                        white-space:normal;

                        box-shadow:
                            0 0 20px
                            ${config.color}55;
                    "
                >
                    ${config.label}
                </div>

            </div>


            <!-- ==================================
                 ENGINEERING + AI
            ================================== -->

            <div
                style="
                    display:grid;

                    grid-template-columns:
                        repeat(
                            2,
                            minmax(0,1fr)
                        );

                    gap:18px;

                    width:100%;
                "
            >


                <!-- ==============================
                     ENGINEERING
                =============================== -->

                <div
                    style="
                        min-width:0;

                        padding:22px;

                        border-radius:16px;

                        background:#151f2e;

                        border:
                            1px solid
                            rgba(255,255,255,.10);

                        box-sizing:border-box;

                        direction:rtl;

                        text-align:right;

                        overflow:visible;
                    "
                >

                    <div
                        style="
                            font-size:20px;
                            font-weight:900;

                            line-height:1.7;

                            color:#c2cfdd;

                            margin-bottom:12px;
                        "
                    >
                        🏗️ رأي اللجنة الهندسية
                    </div>


                    <div
                        style="
                            font-size:25px;
                            font-weight:900;

                            line-height:1.7;

                            color:${config.color};

                            margin-bottom:16px;

                            overflow-wrap:anywhere;
                        "
                    >
                        ${config.label}
                    </div>


                    <div
                        style="
                            font-size:20px;
                            font-weight:600;

                            line-height:2.05;

                            color:#f2f5f8;

                            white-space:normal;

                            overflow-wrap:anywhere;
                        "
                    >

                        <strong
                            style="
                                font-size:20px;
                                font-weight:900;
                                color:#ffffff;
                            "
                        >
                            حيثية القرار:
                        </strong>

                        <div
                            style="
                                margin-top:8px;

                                font-size:20px;
                                font-weight:600;

                                line-height:2.05;

                                color:#e1e8f0;

                                white-space:normal;

                                overflow-wrap:anywhere;
                            "
                        >
                            ${
                                finalDecision?.reason ||
                                'لا تتوفر بيانات كافية لتفسير القرار.'
                            }
                        </div>

                    </div>


                    <div
                        style="
                            margin-top:18px;

                            padding-top:13px;

                            border-top:
                                1px solid
                                rgba(255,255,255,.09);

                            font-size:17px;

                            line-height:1.8;

                            color:#aebdce;
                        "
                    >

                        مستوى المخاطر:

                        <strong
                            style="
                                color:${config.color};

                                font-size:23px;

                                font-weight:900;
                            "
                        >
                            ${riskScore}/100
                        </strong>

                    </div>

                </div>


                <!-- ==============================
                     AI
                =============================== -->

                <div
                    style="
                        min-width:0;

                        padding:22px;

                        border-radius:16px;

                        background:
                            linear-gradient(
                                145deg,
                                #102b31,
                                #101b27
                            );

                        border:
                            1px solid
                            rgba(93,224,139,.25);

                        box-sizing:border-box;

                        direction:rtl;

                        text-align:right;

                        overflow:visible;
                    "
                >

                    <div
                        style="
                            font-size:20px;
                            font-weight:900;

                            line-height:1.7;

                            color:#c2cfdd;

                            margin-bottom:12px;
                        "
                    >
                        🧠 قرار الذكاء الاصطناعي
                    </div>


                    <div
                        style="
                            font-size:25px;
                            font-weight:900;

                            line-height:1.7;

                            color:#5de08b;

                            margin-bottom:16px;

                            overflow-wrap:anywhere;
                        "
                    >
                        ${aiRecommendation}
                    </div>


                    <div
                        style="
                            font-size:20px;
                            font-weight:600;

                            line-height:2.05;

                            color:#f2f5f8;

                            white-space:normal;

                            overflow-wrap:anywhere;
                        "
                    >

                        <strong
                            style="
                                font-size:20px;
                                font-weight:900;
                                color:#ffffff;
                            "
                        >
                            حيثية قرار الذكاء الاصطناعي:
                        </strong>

                        <div
                            style="
                                margin-top:8px;

                                font-size:20px;
                                font-weight:600;

                                line-height:2.05;

                                color:#e1e8f0;

                                white-space:normal;

                                overflow-wrap:anywhere;
                            "
                        >
                            ${aiReason}
                        </div>

                    </div>


                    <div
                        style="
                            margin-top:18px;

                            padding:
                                8px 12px;

                            display:inline-block;

                            max-width:100%;

                            box-sizing:border-box;

                            border-radius:9px;

                            background:
                                rgba(
                                    93,
                                    224,
                                    139,
                                    .10
                                );

                            color:#7de8a2;

                            font-size:13px;

                            font-weight:800;

                            line-height:1.7;

                            white-space:normal;
                        "
                    >
                        دعم القرار الهندسي • مراجعة بشرية مطلوبة
                    </div>

                </div>

            </div>


            <!-- ==================================
                 SATELLITE REPORT
            ================================== -->

            <div
                style="
                    margin-top:18px;

                    padding:20px;

                    border-radius:16px;

                    background:#0d1522;

                    border:
                        1px solid
                        rgba(255,255,255,.08);

                    direction:rtl;

                    text-align:right;

                    box-sizing:border-box;

                    overflow:visible;
                "
            >

                <div
                    style="
                        font-size:18px;

                        font-weight:900;

                        line-height:1.7;

                        color:#c2cfdd;

                        margin-bottom:16px;
                    "
                >
                    🛰️ تقرير الأدلة الفضائية
                </div>


                <div
                    style="
                        display:grid;

                        grid-template-columns:
                            repeat(
                                4,
                                minmax(0,1fr)
                            );

                        gap:16px;

                        width:100%;
                    "
                >

                    <!-- CHANGE -->

                    <div
                        style="
                            min-width:0;
                        "
                    >

                        <div
                            style="
                                font-size:13px;
                                line-height:1.7;
                                color:#8292a7;
                            "
                        >
                            نسبة التغير
                        </div>

                        <div
                            style="
                                margin-top:5px;

                                font-size:23px;
                                font-weight:900;

                                line-height:1.5;

                                color:#ffffff;

                                white-space:nowrap;
                            "
                        >
                            ${satelliteChange.toFixed(2)}%
                        </div>

                    </div>


                    <!-- AREA -->

                    <div
                        style="
                            min-width:0;
                        "
                    >

                        <div
                            style="
                                font-size:13px;
                                line-height:1.7;
                                color:#8292a7;
                            "
                        >
                            المساحة المتغيرة
                        </div>

                        <div
                            style="
                                margin-top:5px;

                                font-size:23px;
                                font-weight:900;

                                line-height:1.5;

                                color:#ffffff;

                                white-space:nowrap;
                            "
                        >
                            ${changedArea.toLocaleString()} م²
                        </div>

                    </div>


                    <!-- WATER -->

                    <div
                        style="
                            min-width:0;
                        "
                    >

                        <div
                            style="
                                font-size:13px;
                                line-height:1.7;
                                color:#8292a7;
                            "
                        >
                            مؤشر المياه والغطاء النباتي
                        </div>

                        <div
                            style="
                                margin-top:5px;

                                font-size:18px;
                                font-weight:900;

                                line-height:1.7;

                                color:
                                    ${
                                        waterDetected
                                            ? '#5de08b'
                                            : '#9aa7b7'
                                    };

                                white-space:normal;
                            "
                        >
                            ${
                                waterDetected
                                    ? '● مكتشف'
                                    : '● غير مكتشف'
                            }
                        </div>

                    </div>


                    <!-- OVERLAP -->

                    <div
                        style="
                            min-width:0;
                        "
                    >

                        <div
                            style="
                                font-size:13px;
                                line-height:1.7;
                                color:#8292a7;
                            "
                        >
                            التداخل مع نطاق التحليل
                        </div>

                        <div
                            style="
                                margin-top:5px;

                                font-size:23px;
                                font-weight:900;

                                line-height:1.5;

                                color:#ffffff;

                                white-space:nowrap;
                            "
                        >
                            ${overlap.toFixed(0)}%
                        </div>

                    </div>

                </div>


                <div
                    style="
                        margin-top:16px;

                        padding-top:13px;

                        border-top:
                            1px solid
                            rgba(255,255,255,.07);

                        font-size:14px;

                        line-height:1.9;

                        color:#9aaabd;
                    "
                >
                    📍 نطاق التحليل المكاني للمصرف:

                    <strong
                        style="
                            color:#d6e0eb;
                            font-weight:900;
                        "
                    >
                        ${
                            overlap > 0
                                ? 'يوجد تداخل مكاني'
                                : 'خارج نطاق التحليل'
                        }
                    </strong>

                </div>

            </div>


            <!-- ==================================
                 FOOTER
            ================================== -->

            <div
                style="
                    margin-top:14px;

                    text-align:center;

                    font-size:11px;

                    line-height:1.7;

                    color:#718198;
                "
            >
                AI Decision Support • Satellite Evidence • Engineering Assessment
            </div>

        </div>

    `;


    // ==========================================
    // FINAL LOG
    // ==========================================

    console.log(
        '🧠 Final Decision:',
        {
            risk:
                currentCase?.risk,

            action:
                currentCase?.action,

            engineeringDecision:
                action,

            irrigationAIAction:
                aiAction
        }
    );

}

// ==================================================
// تحديث Dashboard بعد حساب Engineering Risk
// ==================================================

const riskNumber =
    document.querySelector(
        '.risk-number'
    );

if (riskNumber) {

    riskNumber.innerHTML = `
        ${
            currentCase.engineeringRisk?.riskScore ??
            currentCase.ai?.riskScore ??
            0
        }

        <span style="
            font-size:16px;
        ">
            /100
        </span>
    `;
}

const actionElement =
    document.querySelector(
        '.action'
    );

if (actionElement) {

    const action =
        currentCase.engineeringRisk?.action ??
        currentCase.decision?.action ??
        'monitor';

    const labels = {

        urgent_intervention:
            '🔴 تدخل عاجل',

        field_inspection:
            '🟠 تحتاج معاينة ميدانية',

        inspection:
            '🟠 تحتاج معاينة ميدانية',

        verify:
            '🟡 تحتاج تحقق هندسي',

        monitor:
            '🟢 متابعة'

    };

    actionElement.textContent =
        labels[action] ||
        action ||
        'متابعة';
}
    }

} else {

    console.warn(
        '⚠️ Change ↔ Drain analysis unavailable'
    );

    updateDrainImpactPanel(
        currentCase,
        null
    );
}

// ==================================================
// REAL GIS DRAIN DISPLAY
// ==================================================

if (realGISMode) {

    console.log(
        '🟢 REAL GIS MODE ACTIVE'
    );

    // ------------------------------------------------
    // في وضع REAL:
    // لا نرسم drainLine جديد للحالة
    // لأن realDrainLayer يحتوي بالفعل على الـ160 مصرف
    // ------------------------------------------------

    if (selectedDrainFeature) {

        console.log(
            '🎯 Active REAL drain:',
            {
                id:
                    selectedDrainFeature
                        .properties
                        ?.drainId,

                name:
                    selectedDrainFeature
                        .properties
                        ?.name
            }
        );

    } else {

        console.log(
            'ℹ️ No real drain selected yet — showing all REAL drains'
        );

    }

} else {

    // ==================================================
    // TEST MODE — OLD VIRTUAL DRAIN
    // ==================================================

    if (drainFeature) {

        drainLine =
            L.geoJSON(
                drainFeature,
                {
                    style: {
                        color:
                            risk.color,

                        weight: 6,

                        opacity: 0.90,

                        lineJoin:
                            'round',

                        lineCap:
                            'round'
                    }
                }
            ).addTo(
                gisMap
            );

        console.log(
            '🧪 TEST virtual drain rendered:',
            currentCase.drainId
        );

    } else {

        console.warn(
            '⚠️ TEST drain not found:',
            currentCase.drainId
        );

    }

}   


// ==================================================
    // CHANGE ZONE
    // ==================================================

    const changeArea =
        Math.max(
            0,
            Number(
                detection.changeArea
            ) || 0
        );

    if (changeArea > 0) {

        const estimatedRadius =
            Math.sqrt(
                changeArea /
                Math.PI
            );

        const displayRadius =
            Math.max(
                estimatedRadius,
                35
            );

        changeZone =
            L.circle(
                [lat, lng],
                {

                    radius:
                        displayRadius,

                    color:
                        risk.color,

                    weight:
                        2,

                    fillColor:
                        risk.fillColor,

                    fillOpacity:
                        0.20,

                    interactive:
                        true

                }
            ).addTo(
                gisMap
            );

        changeZone.bindPopup(`

            <div style="
                direction: rtl;
                text-align: right;
                min-width: 230px;
                font-family: Arial, sans-serif;
                line-height: 1.8;
            ">

                <div style="
                    font-size: 16px;
                    font-weight: bold;
                    margin-bottom: 6px;
                ">
                    🛰️ منطقة التغير الهندسي
                </div>

                <hr>

                <div>
                    <strong>CASE ID:</strong>
                    ${currentCase.caseId || '-'}
                </div>

                <div>
                    <strong>المصرف:</strong>
                    ${currentCase.drainId || '-'}
                </div>

                <div>
                    <strong>مساحة التغير:</strong>
                    ${changeArea} m²
                </div>

                <div>
                    <strong>نسبة التغير:</strong>
                    ${detection.changePercentage ?? 0}%
                </div>

                <div>
                    <strong>مستوى الخطورة:</strong>

                    <span style="
                        color: ${risk.color};
                        font-weight: bold;
                    ">
                        ${risk.label}
                    </span>

                </div>

                <div>
                    <strong>Risk:</strong>
                    ${riskScore}/100
                </div>

                <div>
                    <strong>AI Confidence:</strong>
                    ${ai.confidence ?? 0}%
                </div>


           ${spatialAnalysis ? `

    <div style="
        margin-top: 10px;
        padding-top: 8px;
        border-top: 1px solid #ddd;
    ">

        <strong>
            🧠 العلاقة المكانية
        </strong>

    </div>


    <div>
        <strong>
            📏 المسافة الفعلية:
        </strong>

        ${spatialAnalysis.distanceToDrain} m
    </div>


    <div>
        <strong>
            التصنيف:
        </strong>

        <span style="
            color: ${spatialInfo.color};
            font-weight: bold;
        ">
            ${spatialInfo.icon}
            ${spatialInfo.label}
        </span>
    </div>


    <div style="
        margin-top: 6px;
        font-size: 12px;
        opacity: 0.85;
    ">

        <strong>
            📍 أقرب نقطة على المصرف:
        </strong>

        <br>

        ${spatialAnalysis.nearestPoint
            ? `
                ${spatialAnalysis.nearestPoint.lat},
                ${spatialAnalysis.nearestPoint.lng}
              `
            : 'غير متاح'
        }

    </div>


    <div style="
        margin-top: 10px;
        padding: 8px;
        background: #f5f5f5;
        border-radius: 6px;
        font-size: 12px;
        line-height: 1.7;
    ">

        <strong>
            🏗️ Engineering Interpretation
        </strong>

        <div style="margin-top: 4px;">

            ${
                spatialAnalysis.proximity === 'near'

                ? 'الحالة تقع بالقرب من محور المصرف، ويُنصح بمراجعة التغير المكتشف ميدانيًا.'

                : spatialAnalysis.proximity === 'moderate'

                ? 'الحالة تقع ضمن نطاق متوسط القرب من المصرف، ويُفضل مراجعة علاقتها بالمصرف قبل اتخاذ إجراء.'

                : 'الحالة تقع على مسافة بعيدة نسبيًا عن محور المصرف، ولا تظهر حاليًا علاقة مكانية مباشرة قوية مع المصرف وفق التصنيف الحالي.'
            }

        </div>

    </div>

` : ''}
                <div style="
                    margin-top: 8px;
                    padding-top: 6px;
                    border-top: 1px solid #ddd;
                    font-size: 12px;
                    color: #666;
                ">
                    ⚠️ منطقة تقديرية مبنية على
                    مساحة التغير المسجلة.
                </div>

            </div>

        `);

    }

    // ==================================================
    // CASE MARKER
    // ==================================================

    caseMarker =
        L.circleMarker(
            [lat, lng],
            {

                radius:
                    11,

                color:
                    risk.color,

                weight:
                    4,

                fillColor:
                    risk.fillColor,

                fillOpacity:
                    0.90

            }
        ).addTo(
            gisMap
        );

    // ==================================================
    // MARKER POPUP
    // ==================================================

    const popupHTML = `

        <div style="
            direction: rtl;
            text-align: right;
            min-width: 250px;
            font-family: Arial, sans-serif;
            line-height: 1.8;
        ">

            <div style="
                font-size: 17px;
                font-weight: bold;
                margin-bottom: 8px;
            ">
                🛰️ حالة رصد هندسي
            </div>

            <div style="
                border-top: 1px solid #ddd;
                margin: 6px 0;
            "></div>

            <div>
                <strong>CASE ID:</strong>
                ${currentCase.caseId || '-'}
            </div>

            <div>
                <strong>المصرف:</strong>
                ${currentCase.drainId || '-'}
            </div>

            <div>
                <strong>المحافظة:</strong>
                ${currentCase.governorate || '-'}
            </div>

            <div>
                <strong>المركز:</strong>
                ${currentCase.center || '-'}
            </div>

            <div>
                <strong>مساحة التغير:</strong>
                ${detection.changeArea ?? 0} m²
            </div>

            <div>
                <strong>نسبة التغير:</strong>
                ${detection.changePercentage ?? 0}%
            </div>

            <div style="
                margin-top: 6px;
                font-weight: bold;
            ">

                <strong>AI Risk:</strong>

                <span style="
                    color: ${risk.color};
                ">
                    ${riskScore}/100
                </span>

            </div>

            <div>
                <strong>مستوى الخطورة:</strong>
                ${risk.label}
            </div>

            <div>
                <strong>AI Confidence:</strong>
                ${ai.confidence ?? 0}%
            </div>

            <div>
                <strong>الإجراء:</strong>
                ${decision.action || '-'}
            </div>

            <div style="
                margin-top: 8px;
                padding-top: 6px;
                border-top: 1px solid #ddd;
                font-size: 12px;
                color: #555;
            ">

                📍
                ${lat.toFixed(6)},
                ${lng.toFixed(6)}

            </div>
<button
    type="button"
    onclick="window.openSatelliteImagesForCase('${currentCase.caseId}')"
    style="
        width:100%;
        margin-top:12px;
        padding:10px;
        border:0;
        background:#1d6f8f;
        color:#fff;
        font-weight:900;
        cursor:pointer;
        border-radius:7px;
    "
>
    🛰️ عرض صور التحليل Before / After
</button>
        </div>

    `;

   caseMarker.bindPopup(
    popupHTML,
    {
        maxWidth: 320,
        minWidth: 250,
        maxHeight: 320,
        autoPan: true,
        autoPanPaddingTopLeft: [20, 80],
        autoPanPaddingBottomRight: [20, 30],
        keepInView: true
    }
);
    // ==================================================
    // تحريك الخريطة للحالة الجديدة
    // ==================================================

   // ==================================================
// تحريك الخريطة للحالة الجديدة + فتح التقرير
// ==================================================

const targetLatLng =
    L.latLng(lat, lng);

// عند تغيير الحالة أو أول تشغيل:
// الخريطة تتحرك للموقع الجديد
gisMap.flyTo(
    targetLatLng,
    14,
    {
        animate: true,
        duration: 1.2
    }
);

// ننتظر انتهاء الحركة ثم نفتح الـ Popup
setTimeout(() => {

    if (!caseMarker) {
        return;
    }

    // التأكد أن الـ Popup داخل مساحة الخريطة
    gisMap.panTo(
        targetLatLng,
        {
            animate: true,
            duration: 0.4
        }
    );

    setTimeout(() => {

        if (caseMarker) {
            caseMarker.openPopup();
        }

    }, 450);

}, 1250);


    console.log(
        '✅ GIS updated for:',
        currentCase.caseId
    );

}

// ======================================================
// تشغيل Dashboard
// ======================================================
async function initializeDashboard() {

    console.log(
        '🚀 IRRIGATION AI Dashboard starting...'
    );

    // ==========================================
    // REAL DRAIN GIS
    // ==========================================

    await loadDrainsGeoJSON();

    if (drainGeoJsonData) {

        renderRealDrainsOnMap();

        console.log(
            '🟢 REAL DRAIN GIS READY:',
            drainGeoJsonData.features.length
        );
    }

    // ==========================================
    // ضبط الخريطة على المصارف الحقيقية فقط
    // ==========================================

    if (realDrainLayer) {

        const bounds =
            realDrainLayer.getBounds();

        if (bounds.isValid()) {

            gisMap.fitBounds(
                bounds,
                {
                    padding: [30, 30]
                }
            );

        }
    }

    // ==========================================
    // الإحصائيات
    // ==========================================

    await loadCases(false);

    await loadStats();
    
    renderLiveCasesOnMap();
    
    startLiveCaseMonitoring();
    
    console.log(
        '✅ REAL DRAIN GIS DASHBOARD READY'
    );
    
    console.log(
        '🟢 LIVE CASE MONITORING READY'
    );

}



function generateEngineeringDecisionReason(
    engineeringRisk
) {
    if (!engineeringRisk) {
        return 'لا تتوفر بيانات كافية لتفسير القرار.';
    }

    const evidence =
        engineeringRisk.evidence || {};

    console.log(
        '🧪 EVIDENCE SATELLITE VALUE:',
        {
            changePercentage:
                evidence.satelliteChangePercentage,

            changedAreaM2:
                evidence.satelliteChangedAreaM2,

            meanDeltaNDVI:
                evidence.satelliteMeanDeltaNDVI,

            satelliteEvidenceScore:
                evidence.satelliteEvidenceScore
        }
    );

    const reasons = [];

    // ==========================================
    // 🛰️ SATELLITE EVIDENCE
    // ==========================================

    const satelliteChangePercentage =
        Number(
            evidence.satelliteChangePercentage
        ) || 0;

    const satelliteChangedAreaM2 =
        Number(
            evidence.satelliteChangedAreaM2
        ) || 0;

    const satelliteMeanDeltaNDVI =
        Number(
            evidence.satelliteMeanDeltaNDVI
        ) || 0;

    if (
        satelliteChangePercentage > 0 ||
        satelliteChangedAreaM2 > 0
    ) {

        reasons.push(
            `🛰️ رصد القمر الصناعي تغيرًا بنسبة ${satelliteChangePercentage.toFixed(2)}% وبمساحة ${satelliteChangedAreaM2.toFixed(2)} م²`
        );

    }

    // ==========================================
    // 📏 DISTANCE TO DRAIN
    // ==========================================

    if (
        Number.isFinite(
            Number(evidence.distanceToDrain)
        )
    ) {

        reasons.push(
            `المسافة عن المصرف ${Number(
                evidence.distanceToDrain
            ).toFixed(1)} متر`
        );

    }

    // ==========================================
    // 🟦 BUFFER / OVERLAP
    // ==========================================

    if (
        Number(evidence.overlapPercentage) > 0
    ) {

        reasons.push(
            `يوجد تداخل بنسبة ${evidence.overlapPercentage}% مع نطاق المصرف`
        );

    } else {

        reasons.push(
            'لا يوجد تداخل مع نطاق المصرف'
        );

    }

    // ==========================================
    // 📍 SPATIAL RELATION
    // ==========================================

    if (
        evidence.relation === 'outside'
    ) {

        reasons.push(
            'الحالة خارج نطاق الـ 50 متر للمصرف'
        );

    }

    // ==========================================
    // DEFAULT
    // ==========================================

    if (reasons.length === 0) {

        return (
            'لا توجد مؤشرات كافية لاتخاذ إجراء ميداني.'
        );

    }

    return reasons.join(' • ');
}



// ==================================================
// LIVE CASE MONITORING
// عرض الحالات والتعديات المكتشفة على الخريطة
// ==================================================

function getLiveCaseColor(item) {

    const risk =
        Number(
            item?.engineeringRisk?.riskScore ??
            item?.ai?.riskScore ??
            item?.risk ??
            0
        );

    const action =
        item?.decision?.action ||
        item?.action ||
        '';

    if (
        action === 'urgent_intervention' ||
        risk >= 85
    ) {
        return '#ff1744';
    }

    if (
        action === 'field_inspection' ||
        action === 'verify' ||
        risk >= 60
    ) {
        return '#ff9800';
    }

    if (risk >= 30) {
        return '#ffd600';
    }

    return '#00ff88';
}


// ==================================================
// رسم الحالات على الخريطة
// ==================================================

function renderLiveCasesOnMap() {

    if (!gisMap) {
        console.warn(
            '⚠️ GIS map is not ready for live cases'
        );
        return;
    }

    if (
        !Array.isArray(allCases) ||
        allCases.length === 0
    ) {
        console.log(
            'ℹ️ No engineering cases to display'
        );

        if (liveCaseLayer) {
            liveCaseLayer.clearLayers();
        }

        return;
    }

    // ------------------------------------------
    // إنشاء الطبقة أول مرة
    // ------------------------------------------

    if (!liveCaseLayer) {

    liveCaseLayer =
        L.layerGroup();

} else {

    liveCaseLayer.clearLayers();

}

  // ------------------------------------------
// اختيار أحدث تحليل لكل مصرف
// ------------------------------------------

const latestCasesByDrain =
    new Map();

allCases.forEach(
    (item, index) => {

        const drainId =
            String(
                item?.drainId ||
                item?.drain?.id ||
                item?.satelliteChangeDetection?.drainId ||
                ''
            );

        if (!drainId) {
            return;
        }

        const analysisDate =
            new Date(
                item?.satelliteChangeDetection?.currentDate ||
                item?.createdAt ||
                0
            ).getTime();

        const existing =
            latestCasesByDrain.get(
                drainId
            );

        if (
            !existing ||
            analysisDate >
                existing.analysisDate
        ) {

            latestCasesByDrain.set(
                drainId,
                {
                    item,
                    index,
                    analysisDate
                }
            );

        }

    }
);

console.log(
    '🛰️ Latest cases per drain:',
    latestCasesByDrain.size
);

let renderedCount = 0;

latestCasesByDrain.forEach(
    ({ item, index }) => {
            const lat =
                Number(
                    item?.coordinates?.lat
                );

            const lng =
                Number(
                    item?.coordinates?.lng
                );

            if (
                !Number.isFinite(lat) ||
                !Number.isFinite(lng)
            ) {
                return;
            }


            const color =
                getLiveCaseColor(item);


            const risk =
                Number(
                    item?.engineeringRisk?.riskScore ??
                    item?.ai?.riskScore ??
                    item?.risk ??
                    0
                );


            const action =
                item?.decision?.action ||
                item?.action ||
                'monitor';


            const drainId =
                item?.drainId ||
                item?.drain?.id ||
                '—';


            const drainName =
                item?.drainName ||
                item?.drain?.name ||
                'مصرف غير معروف';


                const satelliteChange =
    item?.satelliteChangeDetection || {};

const baselineDate =
    satelliteChange.baselineDate ||
    '—';

const currentDate =
    satelliteChange.currentDate ||
    '—';

const baselineCloud =
    satelliteChange.baselineCloudCover;

const currentCloud =
    satelliteChange.currentCloudCover;

            const changePercentage =
                Number(
                    item?.satelliteChangeDetection
                        ?.changePercentage ??
                    item?.detection
                        ?.changePercentage ??
                    0
                );


            const changedArea =
                Number(
                    item?.satelliteChangeDetection
                        ?.changedAreaM2 ??
                    item?.detection
                        ?.changedAreaM2 ??
                    0
                );


            const confidence =
                Number(
                    item?.ai?.confidence ??
                    item?.detection?.confidenceScore ??
                    0
                );


            // ------------------------------------------
            // ترجمة الإجراء
            // ------------------------------------------

            let actionText =
                'مراقبة';

            if (
                action === 'field_inspection'
            ) {
                actionText =
                    '🟠 تحتاج معاينة ميدانية';
            }
            else if (
                action === 'urgent_intervention'
            ) {
                actionText =
                    '🔴 تحتاج تدخل عاجل';
            }
            else if (
                action === 'verify'
            ) {
                actionText =
                    '🟡 تحتاج تحقق';
            }


            // ------------------------------------------
            // Marker
            // ------------------------------------------

            const marker =
                L.circleMarker(
                    [lat, lng],
                    {
                        radius: 9,

                        color: '#ffffff',

                        weight: 2,

                        fillColor: color,

                        fillOpacity: 0.95,

                        bubblingMouseEvents: true
                    }
                );


            // ------------------------------------------
            // Popup
            // ------------------------------------------

            marker.bindPopup(`
                <div
                    dir="rtl"
                    style="
                        min-width:270px;
                        font-family:Arial,sans-serif;
                        line-height:1.9;
                    "
                >

                    <div
                        style="
                            font-size:20px;
                            font-weight:900;
                            color:${color};
                            margin-bottom:6px;
                        "
                    >
                        🚨 حالة مراقبة
                    </div>

                    <strong>
                        ${drainName}
                    </strong>

                    <br>

                    المصرف:
                    <strong>${drainId}</strong>

                    <br>

                    مستوى الخطورة:
                    <strong>
                        ${risk.toFixed(0)}/100
                    </strong>

                    <br>

                    الحالة:
                    <strong>
                        ${actionText}
                    </strong>

                    <hr>

<div style="
    font-weight:900;
    color:#28d7ff;
    margin-bottom:4px;
">
    🛰️ المرجع الزمني للتحليل
</div>

الصورة السابقة:
<strong>
    ${baselineDate}
</strong>

<br>

الصورة الحالية:
<strong>
    ${currentDate}
</strong>

<br>

جودة الصورة السابقة:
<strong>
    ${
        Number.isFinite(baselineCloud)
            ? baselineCloud.toFixed(1) + '% سحب'
            : '—'
    }
</strong>

<br>

جودة الصورة الحالية:
<strong>
    ${
        Number.isFinite(currentCloud)
            ? currentCloud.toFixed(1) + '% سحب'
            : '—'
    }
</strong>

                    <hr>

                    تغير الأقمار الصناعية:
                    <strong>
                        ${changePercentage.toFixed(2)}%
                    </strong>

                    <br>

                    مساحة التغير:
                    <strong>
                        ${changedArea.toFixed(2)} m²
                    </strong>

                    <br>

                    ثقة التحليل:
                    <strong>
                        ${confidence.toFixed(0)}%
                    </strong>

               
<br><br>

<button
    type="button"
onclick="window.openSatelliteImagesForCase('${item.caseId}')"    style="
        width:100%;
        margin-top:10px;
        padding:9px;
        border:1px solid #1d6f8f;
        background:#1d6f8f;
        color:#fff;
        font-weight:900;
        cursor:pointer;
        border-radius:7px;
    "
>
    🛰️ عرض صور التحليل Before / After
</button>


       </div>
            `);


            marker.addTo(
                liveCaseLayer
            );


            renderedCount++;

        }
    );


    console.log(
        '🟢 LIVE CASES RENDERED:',
        renderedCount
    );
}


// ==================================================
// تحديث بيانات الخريطة الحية
// ==================================================

async function refreshLiveCaseMonitoring() {

    try {

        const response =
            await fetch(
                `${API_BASE}/api/cases`,
                {
                    cache: 'no-store'
                }
            );


        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );

        }


        const data =
            await response.json();


            // ==================================================
// 🎨 عرض صور Sentinel-2 الحقيقية Before / After
// ==================================================

const satelliteResult =
    data?.satelliteChangeDetection ||
    data || {};

const baselineImage =
    data?.baselineResult?.trueColorUrl ||
    satelliteResult
        ?.baselineResult
        ?.trueColorUrl ||
    null;

const currentImage =
    data?.currentResult?.trueColorUrl ||
    satelliteResult
        ?.currentResult
        ?.trueColorUrl ||
    null;

if (
    baselineImage &&
    currentImage
) {

    showSatelliteTrueColorImages(
        baselineImage,
        currentImage,
        data?.baselineDate,
        data?.currentDate
    );

}



        if (
            data.success &&
            Array.isArray(data.cases)
        ) {

            allCases =
                data.cases;


            renderLiveCasesOnMap();


            console.log(
                '🔄 LIVE MONITORING UPDATED:',
                allCases.length,
                'cases'
            );

        }

    }
    catch (error) {

        console.error(
            '❌ Live monitoring refresh failed:',
            error
        );

    }

}


// ==================================================
// تشغيل المراقبة الحية
// ==================================================

function startLiveCaseMonitoring() {

    if (liveCaseRefreshTimer) {

        clearInterval(
            liveCaseRefreshTimer
        );

    }


    // تحديث فوري
    refreshLiveCaseMonitoring();


    // تحديث كل 30 ثانية
    liveCaseRefreshTimer =
        setInterval(
            refreshLiveCaseMonitoring,
            30000
        );


    console.log(
        '🟢 LIVE CASE MONITORING STARTED — 30s refresh'
    );

}



// ======================================================
// REAL GIS MAP
// ======================================================

function initializeGISMap() {

    const mapElement =
        document.getElementById(
            'gisMap'
        );

    if (!mapElement) {

        console.error(
            '❌ GIS map element not found'
        );

        return;

    }

    if (
        typeof L === 'undefined'
    ) {

        console.error(
            '❌ Leaflet library not loaded'
        );

        return;

    }

    if (gisMap) {

        console.log(
            'ℹ️ GIS map already initialized.'
        );

        return;

    }

    gisMap =
    L.map(
        'gisMap',
        {
            maxZoom: 22
        }
    ).setView(
        [30.5, 32.3],
        11
    );



// ==================================================
// GIS FULLSCREEN BUTTON
// ==================================================

initializeGISFullscreenStyles();

const fullscreenControl =
    L.control({
        position: 'topleft'
    });

fullscreenControl.onAdd = function () {

    const container =
        L.DomUtil.create(
            'div',
            'leaflet-control'
        );

    const button =
        L.DomUtil.create(
            'button',
            'gis-fullscreen-btn',
            container
        );

    button.type = 'button';

    button.title =
        'ملء الشاشة';

    button.innerHTML =
        '⛶';

    L.DomEvent.disableClickPropagation(
        button
    );

    L.DomEvent.on(
        button,
        'click',
        toggleGISFullscreen
    );

    return container;
};

fullscreenControl.addTo(
    gisMap
);



// ==================================================
// SATELLITE ANALYSIS POINT BUTTON
// ==================================================

const satellitePointButtonControl =
    L.control({
        position: 'bottomleft'
    });

satellitePointButtonControl.onAdd =
    function () {

        const container =
            L.DomUtil.create(
                'div',
                'leaflet-control'
            );

        const button =
            L.DomUtil.create(
                'button',
                'satellite-point-map-btn',
                container
            );

        button.type = 'button';

        button.title =
            'تحديد موقع التحليل على المصرف';

        button.innerHTML = `
            <span>
                📍
            </span>

            <span>
                تحديد موقع التحليل
            </span>
        `;

        L.DomEvent.disableClickPropagation(
            button
        );

        L.DomEvent.disableScrollPropagation(
            button
        );

        L.DomEvent.on(
            button,
            'click',
            function () {

                if (
                    !window.selectedRealDrain
                ) {

                    console.log(
                        '⚠️ يجب اختيار مصرف أولاً.'
                    );

                    return;
                }

                satellitePointSelectionActive =
                    !satellitePointSelectionActive;

                if (
                    satellitePointSelectionActive
                ) {

                    satelliteAnalysisMode =
                        'drain-location';

                    button.classList.add(
                        'active'
                    );

                    button.title =
                        'اضغط على المصرف لتحديد نقطة التحليل';

                    console.log(
                        '📍 Point selection mode: ON'
                    );

                } else {

                    satelliteAnalysisMode =
                        'drain-property';

                    button.classList.remove(
                        'active'
                    );

                    button.title =
                        'تحديد موقع التحليل على المصرف';

                    console.log(
                        '📍 Point selection mode: OFF'
                    );
                }
            }
        );

        return container;
    };

satellitePointButtonControl.addTo(
    gisMap
);

// ==================================================
// 🛰️ LIVE DRAIN ANALYSIS TOGGLE
// ==================================================

const liveAnalysisControl =
    L.control({
        position: 'topleft'
    });

liveAnalysisControl.onAdd =
    function () {

        const container =
            L.DomUtil.create(
                'div',
                'leaflet-control'
            );

        const button =
            L.DomUtil.create(
                'button',
                'live-analysis-map-btn',
                container
            );

        button.type = 'button';

        button.title =
            'إظهار / إخفاء التحليل اللايف';

        button.innerHTML = `
            <span class="live-analysis-icon">
                ◉
            </span>

            <span class="live-analysis-label">
المراقية الذكية
            </span>
        `;

        L.DomEvent.disableClickPropagation(
            button
        );

        L.DomEvent.disableScrollPropagation(
            button
        );

        L.DomEvent.on(
            button,
            'click',
            function () {

                liveCaseLayerVisible =
                    !liveCaseLayerVisible;

                if (
                    liveCaseLayerVisible
                ) {

                    if (
                        liveCaseLayer
                    ) {

                        liveCaseLayer.addTo(
                            gisMap
                        );

                    }

                    button.classList.add(
                        'active'
                    );

                    button.title =
                        'إخفاء التحليل اللايف';

                } else {

                    if (
                        liveCaseLayer &&
                        gisMap.hasLayer(
                            liveCaseLayer
                        )
                    ) {

                        gisMap.removeLayer(
                            liveCaseLayer
                        );

                    }

                    button.classList.remove(
                        'active'
                    );

                    button.title =
                        'إظهار التحليل اللايف';
                }

            }
        );

        return container;
    };

liveAnalysisControl.addTo(
    gisMap
);

    // ==================================================
    // GIS BASEMAPS
    // ==================================================

    const osmLayer =
        L.tileLayer(
            'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            {

                maxZoom:
                    22,

                attribution:
                    '&copy; OpenStreetMap contributors'

            }
        );

        const satelliteLayer =
        L.tileLayer(
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            {
                maxZoom: 22,
                attribution:
                    'Tiles &copy; Esri'
            }
        );
    
    
    // ==================================================
    // HIGH RESOLUTION / CLARITY IMAGERY
    // ==================================================
    
    const claritySatelliteLayer =
    L.tileLayer(
        'https://api.maptiler.com/maps/satellite-v4/256/{z}/{x}/{y}.jpg?key=ZS5H1lGg3V3lMcOwguCJ',
        {
            maxZoom: 20,
            attribution:
                '&copy; MapTiler &copy; OpenStreetMap contributors'
        }
    );


    osmLayer.addTo(
        gisMap
    );

  const baseMaps = {

    '🗺️ خريطة الشوارع':
        osmLayer,

    '🛰️ Satellite':
        satelliteLayer,

    '🔬 High Resolution / Clarity':
        claritySatelliteLayer

};

    L.control.layers(
        baseMaps,
        null,
        {

            position:
                'topright',

            collapsed:
                false

        }
    ).addTo(
        gisMap
    );

    console.log(
        '🗺️ GIS Map initialized successfully'
    );

}


// ==================================================
// GIS FULLSCREEN STYLES
// ==================================================

function initializeGISFullscreenStyles() {

    if (document.getElementById('gisFullscreenStyles')) {
        return;
    }

    const style = document.createElement('style');

    style.id = 'gisFullscreenStyles';

    style.textContent = `
        #gisMap.gis-fullscreen {
            position: fixed !important;
            inset: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            z-index: 99999 !important;
            border-radius: 0 !important;
        }

        .gis-fullscreen-btn {
            background: #ffffff;
            width: 40px;
            height: 40px;
            border: none;
            border-radius: 6px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
            cursor: pointer;
            font-size: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .gis-fullscreen-btn:hover {
            background: #f1f1f1;
        }
    `;

    document.head.appendChild(style);
}


// ==================================================
// GIS FULLSCREEN TOGGLE
// ==================================================

function toggleGISFullscreen() {

    const mapElement =
        document.getElementById('gisMap');

    if (!mapElement) {
        console.error('❌ gisMap element not found');
        return;
    }

    const isFullscreen =
        mapElement.classList.contains(
            'gis-fullscreen'
        );

    if (isFullscreen) {

        mapElement.classList.remove(
            'gis-fullscreen'
        );

        console.log(
            '↩️ GIS returned to normal mode'
        );

    } else {

        mapElement.classList.add(
            'gis-fullscreen'
        );

        console.log(
            '🗺️ GIS Fullscreen activated'
        );
    }

    setTimeout(() => {

        if (gisMap) {
            gisMap.invalidateSize();
        }

    }, 300);
}

// ======================================================
// BUILD NEW ANALYSIS CASE FROM SELECTED REAL DRAIN
// ======================================================

function buildDrainAnalysisCase(
    selectedDrain,
    selectedAOI,
    satelliteChangeDetection,
    sourceCase = null
) {

    if (!selectedDrain) {
        throw new Error(
            'لا يمكن إنشاء Analysis Case بدون مصرف حقيقي.'
        );
    }

    const properties =
        selectedDrain.properties || {};

    const geometry =
        selectedDrain.geometry || {};

            selectedDrain.geometry || {};


            // ------------------------------------------
// Satellite Result
// ------------------------------------------

const satellite =
    satelliteChangeDetection || {};

// ------------------------------------------
// حساب مركز المصرف / AOI
// ------------------------------------------

const isPointAnalysis =
    satellite?.aoiMode ===
    'drain-location' ||
    satellite?.aoi?.mode ===
    'drain-location';

const analysisPoint =
    satellite?.analysisPoint || null;

const pointLat =
    Number(
        analysisPoint?.lat
    );

const pointLng =
    Number(
        analysisPoint?.lng
    );

const centerLat =
    isPointAnalysis &&
    Number.isFinite(pointLat)
        ? pointLat
        : (
            Number(selectedAOI.minLat) +
            Number(selectedAOI.maxLat)
        ) / 2;

const centerLng =
    isPointAnalysis &&
    Number.isFinite(pointLng)
        ? pointLng
        : (
            Number(selectedAOI.minLng) +
            Number(selectedAOI.maxLng)
        ) / 2;

        

        

    // ------------------------------------------
    // Case ID مؤقت جديد
    // ------------------------------------------

    const timestamp =
        Date.now();

    const drainId =
        properties.drainId ||
        selectedAOI.drainId ||
        'UNKNOWN_DRAIN';

    const analysisCaseId =
        `DRAIN-${drainId}-${timestamp}`;

    // ------------------------------------------
    // Satellite Result
    // ------------------------------------------

  
    // ------------------------------------------
    // Satellite Confidence
    //
    // الأولوية:
    // 1. confidence العام
    // 2. confidenceScore العام
    // 3. confidence الخاص بـ waterHyacinth
    // ------------------------------------------

    const satelliteConfidence =
        Number(
            satellite.confidence
        ) ||
        Number(
            satellite.confidenceScore
        ) ||
        Number(
            satellite.waterHyacinth?.confidence
        ) ||
        0;

    // ------------------------------------------
    // تحويل Satellite إلى Detection
    // ------------------------------------------

    const detection = {

        changeArea:
            Number(
                satellite.changedAreaM2
            ) || 0,

        changePercentage:
            Number(
                satellite.changePercentage
            ) || 0,

        confidenceScore:
            satelliteConfidence
    };

    // ------------------------------------------
    // AI
    //
    // لا ننسخ AI risk من old case
    // ------------------------------------------

    const ai = {

        riskScore: 0,

        confidence:
            detection.confidenceScore,

        reason:
            'Satellite-derived engineering analysis'
    };

    // ------------------------------------------
    // Case جديدة بالكامل
    // ------------------------------------------

    const analysisCase = {

        caseId:
            analysisCaseId,

        source:
            'real_drain_satellite',

        analysisType:
            'engineering_drain_analysis',

        drainId:
            drainId,

        drainName:
            properties.name ||
            null,

       country:
    properties.country ||
    null,

governorate:
    properties.governorate ||
    null,

        center:
            sourceCase?.center ||
            null,

        coordinates: {

            lat:
                Number.isFinite(centerLat)
                    ? centerLat
                    : null,

            lng:
                Number.isFinite(centerLng)
                    ? centerLng
                    : null
        },

        drain: {

            id:
                drainId,

            name:
                properties.name ||
                null,

            lengthM:
                Number(
                    properties.lengthM
                ) || 0,

            lengthKm:
                Number(
                    properties.lengthKm
                ) || 0,

            pointCount:
                Number(
                    properties.pointCount
                ) || 0,

            geometry:
                geometry
        },

      aoi: {

    drainId:
        selectedAOI.drainId ||
        drainId,

    minLat:
        Number(
            satellite?.aoi?.minLat ??
            selectedAOI.minLat
        ),

    maxLat:
        Number(
            satellite?.aoi?.maxLat ??
            selectedAOI.maxLat
        ),

    minLng:
        Number(
            satellite?.aoi?.minLng ??
            selectedAOI.minLng
        ),

    maxLng:
        Number(
            satellite?.aoi?.maxLng ??
            selectedAOI.maxLng
        ),

    bounds:
        selectedAOI.bounds ||
        null,

    geometry:
        selectedAOI.geometry ||
        geometry,

    mode:
        satellite?.aoiMode ||
        satellite?.aoi?.mode ||
        'drain-property',

    analysisPoint:
        satellite?.analysisPoint ||
        null,

    chainageKm:
        Number.isFinite(
            Number(
                satellite?.chainageKm
            )
        )
            ? Number(
                satellite.chainageKm
            )
            : null,

    bufferMeters:
        Number(
            satellite?.aoi?.bufferMeters ||
            50
        )
},
        detection,

        ai,

        satelliteChangeDetection:
            satellite,

        createdAt:
            new Date().toISOString(),

        parentCaseId:
            sourceCase?.caseId ||
            null
    };

    console.log(
        '🆕 NEW REAL DRAIN ANALYSIS CASE:',
        analysisCase
    );

    return analysisCase;
}






// ======================================================
// تشغيل Satellite + Engineering AI Pipeline
// REAL DRAIN = SOURCE OF TRUTH
// ======================================================

async function runSatellitePipeline() {

    const button =
        document.getElementById(
            'downloadDrainsBtn'
        );

    if (!button) {

        console.warn(
            '⚠️ downloadDrainsBtn not found'
        );

        return;
    }

    const originalText =
        button.innerHTML;

    try {

        button.disabled = true;

        button.innerHTML =
            '⏳ جاري تحليل المصرف الحقيقي...';

        console.log(
            '🛰️ Starting REAL Satellite + Engineering AI pipeline...'
        );

        // ==================================================
        // 1. SELECTED REAL DRAIN
        // ==================================================

        const selectedDrain =
            window.selectedRealDrain || null;

        const selectedAOI =
            window.selectedDrainAOI || null;

        console.log(
            '🎯 SELECTED REAL DRAIN:',
            {
                drainId:
                    selectedDrain
                        ?.properties
                        ?.drainId || null,

                name:
                    selectedDrain
                        ?.properties
                        ?.name || null,

                geometry:
                    selectedDrain
                        ?.geometry || null,

                aoi:
                    selectedAOI
            }
        );

        // ==================================================
        // 2. VALIDATION
        // ==================================================

     
        if (!selectedAOI) {

            throw new Error(
                'لم يتم إنشاء منطقة التحليل AOI للمصرف المحدد.'
            );
        }

       // ==================================================
// 2. VALIDATION
// ==================================================

if (!selectedDrain) {

    throw new Error(
        'يجب اختيار مصرف حقيقي من الخريطة قبل تشغيل تحليل الأقمار الصناعية.'
    );

}

if (!selectedAOI) {

    throw new Error(
        'لم يتم إنشاء منطقة التحليل AOI للمصرف المحدد.'
    );

}


// ==================================================
// تحديد نوع تحليل الأقمار الصناعية
// ==================================================

const isPointSatelliteAnalysis =
    satelliteAnalysisMode ===
    'drain-location';


// ==================================================
// تحليل نقطة محددة
// ==================================================

if (
    isPointSatelliteAnalysis
) {

    if (
        !selectedSatellitePoint ||
        !Number.isFinite(
            Number(
                selectedSatellitePoint.lat
            )
        ) ||
        !Number.isFinite(
            Number(
                selectedSatellitePoint.lng
            )
        )
    ) {

        throw new Error(
            'يجب تحديد نقطة التحليل على المصرف أولاً.'
        );

    }

    console.log(
        '📍 SATELLITE POINT ANALYSIS:',
        selectedSatellitePoint
    );

}


// ==================================================
// تحليل المصرف بالكامل
// ==================================================

else {

    const hasValidAOI =
        Number.isFinite(
            Number(selectedAOI.minLat)
        ) &&
        Number.isFinite(
            Number(selectedAOI.maxLat)
        ) &&
        Number.isFinite(
            Number(selectedAOI.minLng)
        ) &&
        Number.isFinite(
            Number(selectedAOI.maxLng)
        );

    if (!hasValidAOI) {

        throw new Error(
            'بيانات حدود منطقة تحليل المصرف AOI غير صحيحة.'
        );

    }

}
        // ==================================================
        // 3. OLD CASE
        //
        // تستخدم فقط كـ parent/context
        // وليست مصدر التحليل
        // ==================================================

        const parentCase =
            allCases?.[selectedCaseIndex] || null;

        console.log(
            '📋 PARENT CASE ONLY:',
            {
                caseId:
                    parentCase?.caseId || null,

                drainId:
                    parentCase?.drainId || null
            }
        );

        // ==================================================
        // 4. REAL DRAIN CENTER
        //
        // لا نعتمد على old case coordinates
        // ==================================================

     // ==================================================
// 4. REAL ANALYSIS CENTER
// ==================================================
//
// في تحليل النقطة:
// نستخدم النقطة التي اختارها المستخدم.
//
// في تحليل المصرف بالكامل:
// نستخدم مركز AOI القديم.
// ==================================================

const drainCenterLat =
    isPointSatelliteAnalysis
        ? Number(
            selectedSatellitePoint.lat
        )
        : (
            Number(selectedAOI.minLat) +
            Number(selectedAOI.maxLat)
        ) / 2;

const drainCenterLng =
    isPointSatelliteAnalysis
        ? Number(
            selectedSatellitePoint.lng
        )
        : (
            Number(selectedAOI.minLng) +
            Number(selectedAOI.maxLng)
        ) / 2;


console.log(
    '📍 REAL SATELLITE ANALYSIS CENTER:',
    {
        mode:
            isPointSatelliteAnalysis
                ? 'drain-location'
                : 'drain-property',

        lat:
            drainCenterLat,

        lng:
            drainCenterLng,

        chainageKm:
            isPointSatelliteAnalysis
                ? selectedSatellitePoint.chainageKm
                : null
    }
);
        // ==================================================
        // 5. SATELLITE COMPARE
        // ==================================================

        console.log(
            '🛰️ Starting REAL satellite change detection...'
        );

        const compareResponse =
            await fetch(
                `${API_BASE}/api/satellite/compare`,
                {
                    method: 'POST',

                    headers: {
                        'Content-Type':
                            'application/json'
                    },

                    body:
                    JSON.stringify({
                
                        // ==========================================
                        // مركز الـ AOI
                        // ==========================================
                
                        lat:
                            Number.isFinite(
                                drainCenterLat
                            )
                                ? drainCenterLat
                                : null,
                
                        lng:
                            Number.isFinite(
                                drainCenterLng
                            )
                                ? drainCenterLng
                                : null,
                
                        // ==========================================
                        // AOI الحقيقي
                        // أملاك المصرف + 50 متر
                        // ==========================================
                
                    aoi: {

    drainId:
        selectedAOI.drainId,

    // ==================================================
    // لو المستخدم اختار نقطة محددة على المصرف
    // ==================================================

    ...(isPointSatelliteAnalysis
        ? {

            analysisPoint: {

                lat:
                    Number(
                        selectedSatellitePoint.lat
                    ),

                lng:
                    Number(
                        selectedSatellitePoint.lng
                    )

            },

            chainageKm:
                Number(
                    selectedSatellitePoint.chainageKm
                ),

            bufferMeters:
                50,

            basedOn:
                'drain-location'

        }

        // ==================================================
        // لو تحليل المصرف بالكامل
        // ==================================================

        : {

            minLat:
                selectedAOI.minLat,

            maxLat:
                selectedAOI.maxLat,

            minLng:
                selectedAOI.minLng,

            maxLng:
                selectedAOI.maxLng,

            bounds:
                selectedAOI.bounds,

            geometry:
                selectedAOI.geometry,

            bufferMeters:
                50,

            basedOn:
                'drain-property'

        }
    )

},               
                        baselineDate:
                            null,
                
                        currentDate:
                            null
                    })        
                
                }
            );


console.log(
    '🛰️ SATELLITE HTTP RESPONSE:',
    {
        status: compareResponse.status,
        ok: compareResponse.ok,
        statusText: compareResponse.statusText
    }
);


        const compareResult =
            await compareResponse.json();


            console.log(
    '🛰️ SATELLITE ERROR/RESPONSE BODY:',
    compareResult
);

            const irrigationAI =
    compareResult?.comparison?.irrigationAI || null;

window.latestIrrigationAI =
    irrigationAI;

console.log(
    '🧠 IRRIGATION AI DECISION:',
    irrigationAI
);

       console.log(
    '🧪 FULL SATELLITE COMPARE RESPONSE:',
    JSON.stringify(compareResult, null, 2)
);
       if (!compareResponse.ok) {

    if (
        compareResult?.error?.startsWith(
            'NO_NEW_SATELLITE_IMAGE'
        )
    ) {

       const lastAnalysisDate =
    compareResult.error.match(
        /newer than (\d{4}-\d{2}-\d{2})/
    )?.[1] || null;

showSatelliteNoNewImageMessage(
    lastAnalysisDate
);



        button.innerHTML =
            originalText;

        button.disabled = false;

        return;
    }

    throw new Error(
        compareResult.message ||
        'Satellite comparison failed.'
    );
}
        // ==================================================
        // 6. SATELLITE RESULT
        // ==================================================

     const satelliteChangeDetection =
    compareResult
        .comparison
        ?.satelliteChangeDetection ||
    null;

window.latestSatelliteChangeDetection =
    satelliteChangeDetection;

console.log(
  '🛰️ FULL SATELLITE RESULT:',
  JSON.stringify(
    window.latestSatelliteChangeDetection,
    null,
    2
  )
);


        console.log(
            '🛰️ SATELLITE RESULT FOR REAL DRAIN:',
            satelliteChangeDetection
        );

        if (!satelliteChangeDetection) {

            throw new Error(
                'لم ترجع خدمة الأقمار الصناعية بيانات تحليل صالحة للمصرف المحدد.'
            );
        }

        // ==================================================
        // 7. CREATE NEW ANALYSIS CASE
        //
        // هنا النقطة الأساسية:
        // لا نعدل currentCase
        // ==================================================

        const analysisCase =
            buildDrainAnalysisCase(
                selectedDrain,
                selectedAOI,
                satelliteChangeDetection,
                parentCase
            );


            analysisCase.irrigationAI =
    compareResult?.comparison?.irrigationAI ?? null;

        console.log(
            '🆕 ANALYSIS CASE CREATED BEFORE ENGINEERING:',
            analysisCase
        );

        // ==================================================
        // 8. SPATIAL ANALYSIS
        //
        // باستخدام مركز المصرف الجديد
        // ==================================================

        const spatialAnalysis =
            analyzeCaseDrainSpatialRelation(
                analysisCase,
                selectedDrain
            );

        console.log(
            '📏 NEW CASE SPATIAL ANALYSIS:',
            spatialAnalysis
        );

        // ==================================================
        // 9. CHANGE ↔ DRAIN BUFFER
        // ==================================================

        const changeDrainAnalysis =
            analyzeChangeAgainstDrainBuffer(
                analysisCase,
                selectedDrain,
                50
            );

        console.log(
            '🔗 NEW CASE CHANGE ↔ DRAIN:',
            changeDrainAnalysis
        );

        // ==================================================
        // 10. ENGINEERING RISK
        //
        // الآن كل المدخلات تخص المصرف الجديد
        // ==================================================

        const engineeringRisk =
            calculateEngineeringRisk(
                analysisCase,
                spatialAnalysis,
                changeDrainAnalysis,
                satelliteChangeDetection
            );

        console.log(
            '🚨 NEW ENGINEERING RISK:',
            engineeringRisk
        );

        if (!engineeringRisk) {

            throw new Error(
                'تعذر حساب Engineering Risk للمصرف المحدد.'
            );
        }

        analysisCase.engineeringRisk =
            engineeringRisk;

        // ==================================================
        // 11. FINAL DECISION
        // ==================================================

        const finalDecision =
            calculateFinalDecision(
                engineeringRisk
            );

        if (finalDecision) {

            finalDecision.reason =
                generateEngineeringDecisionReason(
                    engineeringRisk
                );

            analysisCase.finalDecision =
                finalDecision;

            analysisCase.risk =
                finalDecision.riskScore;

            analysisCase.action =
                finalDecision.action;

            analysisCase.reason =
                finalDecision.reason;
        }

       // ==================================================
// 12. SAVE NEW CASE TO BACKEND
//
// حفظ دائم في engineering_cases.json
// ==================================================
// ==================================================
// 12. SAVE NEW CASE TO BACKEND
// ==================================================

const saveCaseResponse =
    await fetch(
        `${API_BASE}/api/cases/save-analysis`,
        {
            method: 'POST',

            headers: {
                'Content-Type':
                    'application/json'
            },

            body:
                JSON.stringify({
                    case: analysisCase
                })
        }
    );

const saveCaseResult =
    await saveCaseResponse.json();

console.log(
    '💾 SAVE ANALYSIS RESPONSE:',
    JSON.stringify(
        saveCaseResult,
        null,
        2
    )
);

if (!saveCaseResponse.ok) {

    throw new Error(
        saveCaseResult?.message ||
        'فشل حفظ التحليل الجديد.'
    );
}


// ==================================================
// 13. UPDATE LOCAL CASE STATE
// ==================================================

allCases.push(
    analysisCase
);

selectedCaseIndex =
    allCases.length - 1;

updateCaseSelector(
    allCases
);

renderSelectedCase();


// ==================================================
// 14. UPDATE LIVE MAP
// ==================================================

renderLiveCasesOnMap();


// ==================================================
// 15. UPDATE STATS
// ==================================================

await loadStats();

console.log(
    '🟢 NEW CASE + LIVE MAP UPDATED',
    {
        caseId:
            analysisCase.caseId,

        drainId:
            analysisCase.drainId,

        currentDate:
            analysisCase
                .satelliteChangeDetection
                ?.currentDate,

        createdAt:
            analysisCase.createdAt
    }
);
        await loadStats();

        // ==================================================
        // 16. SUCCESS
        // ==================================================

        button.innerHTML =
            '✅ تم إنشاء تحليل جديد للمصرف';

        console.log(
            '✅ REAL DRAIN → SATELLITE → ENGINEERING → NEW CASE COMPLETE',
            {
                caseId:
                    analysisCase.caseId,

                drainId:
                    analysisCase.drainId,

                coordinates:
                    analysisCase.coordinates,

                satellite:
                    analysisCase.satelliteChangeDetection,

                engineeringRisk:
                    analysisCase.engineeringRisk,

                finalDecision:
                    analysisCase.finalDecision
            }
        );

        setTimeout(
            () => {

                button.innerHTML =
                    originalText;

            },
            2500
        );

  } catch (error) {

    console.error(
        '❌ REAL Satellite pipeline error:',
        error
    );

    button.innerHTML =
        '❌ فشل التحليل';

    showSatelliteErrorMessage(error);

    setTimeout(
        () => {

            button.innerHTML =
                originalText;

        },
        2500
    );


    } finally {

        button.disabled = false;
    }
}

window.openSatelliteImagesForCase = function (caseRef) {

    console.log(
        '🛰️ OPEN SATELLITE REQUEST:',
        caseRef
    );

    let c = null;


    /* =========================================
       1. لو اتبعت Object مباشرة
    ========================================= */

    if (
        caseRef &&
        typeof caseRef === 'object'
    ) {

        c = caseRef;

    }


    /* =========================================
       2. البحث في allCases
    ========================================= */

    if (
        !c &&
        Array.isArray(allCases)
    ) {

        c =
            allCases.find(
                item =>
                    String(item?.caseId) ===
                    String(caseRef)
            );

    }


    /* =========================================
       3. البحث في latest cases
    ========================================= */

    if (
        !c &&
        Array.isArray(window.latestCases)
    ) {

        c =
            window.latestCases.find(
                item =>
                    String(item?.caseId) ===
                    String(caseRef)
            );

    }


    /* =========================================
       4. البحث في الحالات الموجودة
          في الخريطة / GIS
    ========================================= */

    if (
        !c &&
        typeof window.currentGISCase !==
        'undefined' &&
        window.currentGISCase
    ) {

        const gisCase =
            window.currentGISCase;

        if (
            String(gisCase?.caseId) ===
            String(caseRef)
        ) {

            c = gisCase;

        }

    }


    console.log(
        '🛰️ SATELLITE CASE:',
        c
    );


    /* =========================================
       CASE NOT FOUND
    ========================================= */

    if (!c) {

        console.error(
            '❌ CASE NOT FOUND:',
            caseRef
        );

        alert(
            'لم يتم العثور على بيانات الحالة.'
        );

        return;

    }


    /* =========================================
       DRAIN ID
    ========================================= */

    const drainId =
        c?.drainId ||
        c?.drain?.id ||
        c?.drain?.drainId ||
        c?.drain?.name ||
        '';


    /* =========================================
       SATELLITE DATA
    ========================================= */

    const satellite =
        c?.satelliteChangeDetection ||
        c?.satellite ||
        {};


    console.log(
        '🛰️ DRAIN:',
        drainId
    );

    console.log(
        '🛰️ SATELLITE DATA:',
        satellite
    );


    /* =========================================
       DATES
    ========================================= */

    const baselineDate =
        satellite?.baselineDate ||
        c?.baselineDate ||
        '';

    const currentDate =
        satellite?.currentDate ||
        c?.currentDate ||
        '';


    console.log(
        '🛰️ BASELINE DATE:',
        baselineDate
    );

    console.log(
        '🛰️ CURRENT DATE:',
        currentDate
    );


    /* =========================================
       VALIDATION
    ========================================= */

    if (
        !drainId ||
        !baselineDate ||
        !currentDate
    ) {

        console.error(
            '❌ INCOMPLETE SATELLITE DATA:',
            {
                drainId,
                baselineDate,
                currentDate,
                case: c
            }
        );

        alert(
            'بيانات المصرف أو تواريخ صور Sentinel-2 غير متوفرة لهذه الحالة.'
        );

        return;

    }


    /* =========================================
       BUILD IMAGE URLS
    ========================================= */

    const baselineUrl =
        `/satellite/truecolor_${drainId}_${baselineDate}.png`;

    const currentUrl =
        `/satellite/truecolor_${drainId}_${currentDate}.png`;


    console.log(
        '🛰️ BEFORE IMAGE:',
        baselineUrl
    );

    console.log(
        '🛰️ AFTER IMAGE:',
        currentUrl
    );


    /* =========================================
       OPEN VIEWER
    ========================================= */

    showSatelliteTrueColorImages(
        baselineUrl,
        currentUrl,
        baselineDate,
        currentDate
    );

};
// ==================================================
// 🎨 SATELLITE TRUE COLOR VIEWER
// Before / After
// ==================================================


function showSatelliteTrueColorImages(
    baselineUrl,
    currentUrl,
    baselineDate,
    currentDate
) {

    const oldViewer =
        document.getElementById(
            'satelliteTrueColorViewer'
        );

    if (oldViewer) {
        oldViewer.remove();
    }

    const viewer =
        document.createElement('div');

    viewer.id =
        'satelliteTrueColorViewer';

    viewer.dir = 'rtl';

    viewer.innerHTML = `

        <div style="
            position:fixed;
            inset:0;
            z-index:99999;
            background:rgba(5,15,25,.82);
            backdrop-filter:blur(8px);
            display:flex;
            align-items:center;
            justify-content:center;
            padding:20px;
            box-sizing:border-box;
        ">

            <div style="
                width:min(1400px,97vw);
                max-height:94vh;
                overflow:auto;
                background:#fff;
                border-radius:24px;
                box-shadow:0 25px 90px rgba(0,0,0,.45);
                padding:24px;
                box-sizing:border-box;
            ">

                <!-- HEADER -->
                <div style="
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                    gap:15px;
                    margin-bottom:22px;
                ">

                    <div>

                        <div style="
                            font-size:25px;
                            font-weight:800;
                            color:#123;
                            margin-bottom:6px;
                        ">
                            🛰️ التحليل الفضائي — صور الأقمار الصناعية
                        </div>

                        <div style="
                            color:#667;
                            font-size:14px;
                        ">
                            مقارنة الصورة الفضائية قبل وبعد التحليل
                        </div>

                    </div>

                    <button
                        id="closeSatelliteTrueColor"
                        type="button"
                        style="
                            border:0;
                            background:#e9eef3;
                            width:44px;
                            height:44px;
                            border-radius:50%;
                            font-size:20px;
                            cursor:pointer;
                            transition:.2s;
                        "
                    >
                        ✕
                    </button>

                </div>


                <!-- IMAGES -->
                <div style="
                    display:grid;
                    grid-template-columns:
                        repeat(
                            auto-fit,
                            minmax(320px,1fr)
                        );
                    gap:22px;
                ">


                    <!-- BEFORE -->
                    <div style="
                        background:#f7f9fb;
                        border:1px solid #e3e8ee;
                        border-radius:20px;
                        padding:14px;
                    ">

                        <div style="
                            display:flex;
                            justify-content:space-between;
                            align-items:center;
                            margin-bottom:12px;
                        ">

                            <div style="
                                font-size:16px;
                                font-weight:800;
                                color:#263746;
                            ">
                                📅 قبل التحليل
                            </div>

                            <div style="
                                background:#e8eef4;
                                border:1px solid #d7e0e8;
                                color:#456;
                                padding:6px 10px;
                                border-radius:10px;
                                font-size:12px;
                                font-weight:700;
                            ">
                                ${baselineDate || ''}
                            </div>

                        </div>


                        <!-- BEFORE IMAGE -->
                        <div
                            data-satellite-viewport="before"
                            style="
                                overflow:hidden;
                                border-radius:15px;
                                box-shadow:
                                    0 8px 25px rgba(0,0,0,.18);
                                background:#111;
                                cursor:zoom-in;
                                position:relative;
                            "
                        >

                            <img
                                src="${baselineUrl}"
                                alt="Satellite Before"
                                draggable="false"
                                style="
                                    width:100%;
                                    height:auto;
                                    display:block;
                                    object-fit:contain;
                                    transform:scale(1);
                                    transform-origin:center center;
                                    transition:transform .25s ease;
                                    user-select:none;
                                    -webkit-user-drag:none;
                                "
                                onerror="
                                    this.style.display='none';
                                    this.parentElement.innerHTML +=
                                    '<div style=&quot;color:white;padding:50px;text-align:center;&quot;>تعذر تحميل الصورة</div>';
                                "
                            />

                        </div>

                    </div>


                    <!-- AFTER -->
                    <div style="
                        background:#f7f9fb;
                        border:1px solid #e3e8ee;
                        border-radius:20px;
                        padding:14px;
                    ">

                        <div style="
                            display:flex;
                            justify-content:space-between;
                            align-items:center;
                            margin-bottom:12px;
                        ">

                            <div style="
                                font-size:16px;
                                font-weight:800;
                                color:#263746;
                            ">
                                📅 بعد التحليل
                            </div>

                            <div style="
                                background:#e8eef4;
                                border:1px solid #d7e0e8;
                                color:#456;
                                padding:6px 10px;
                                border-radius:10px;
                                font-size:12px;
                                font-weight:700;
                            ">
                                ${currentDate || ''}
                            </div>

                        </div>


                        <!-- AFTER IMAGE -->
                        <div
                            data-satellite-viewport="after"
                            style="
                                overflow:hidden;
                                border-radius:15px;
                                box-shadow:
                                    0 8px 25px rgba(0,0,0,.18);
                                background:#111;
                                cursor:zoom-in;
                                position:relative;
                            "
                        >

                            <img
                                src="${currentUrl}"
                                alt="Satellite After"
                                draggable="false"
                                style="
                                    width:100%;
                                    height:auto;
                                    display:block;
                                    object-fit:contain;
                                    transform:scale(1);
                                    transform-origin:center center;
                                    transition:transform .25s ease;
                                    user-select:none;
                                    -webkit-user-drag:none;
                                "
                                onerror="
                                    this.style.display='none';
                                    this.parentElement.innerHTML +=
                                    '<div style=&quot;color:white;padding:50px;text-align:center;&quot;>تعذر تحميل الصورة</div>';
                                "
                            />

                        </div>

                    </div>

                </div>


                <!-- FOOTER -->

                <div style="
                    display:flex;
                    justify-content:center;
                    margin-top:18px;
                ">

                    <button
                        id="satelliteFullscreenBtn"
                        type="button"
                        style="
                            border:0;
                            background:#123;
                            color:#fff;
                            padding:11px 22px;
                            border-radius:12px;
                            font-size:14px;
                            font-weight:700;
                            cursor:pointer;
                        "
                    >
                        ⛶ عرض ملء الشاشة
                    </button>

                </div>


                <div style="
                    margin-top:20px;
                    padding:13px 16px;
                    background:#f4f7fa;
                    border-radius:14px;
                    color:#596a78;
                    font-size:13px;
                    text-align:center;
                ">
                    🛰️ صور Sentinel-2 الحقيقية المستخدمة في التحليل
                </div>

            </div>

        </div>
    `;


    document.body.appendChild(viewer);


    /* =====================================================
       FULLSCREEN
    ===================================================== */

    const fullscreenBtn =
        viewer.querySelector(
            '#satelliteFullscreenBtn'
        );

    fullscreenBtn?.addEventListener(
        'click',
        async () => {

            const content =
                viewer.querySelector(
                    'div[style*="width:min(1400px"]'
                );

            try {

                if (
                    !document.fullscreenElement
                ) {

                    await content?.requestFullscreen();

                } else {

                    await document.exitFullscreen();

                }

            } catch (error) {

                console.warn(
                    'Fullscreen error:',
                    error
                );

            }

        }
    );


    /* =====================================================
       ZOOM
       1x → 2x → 4x → 8x → 1x
       لكل صورة بشكل مستقل
    ===================================================== */

   const satelliteImages =
    viewer.querySelectorAll(
        'img[alt^="Satellite"]'
    );

satelliteImages.forEach(img => {

    let zoom = 1;
    let panX = 0;
    let panY = 0;

    const viewport = img.parentElement;

    img.style.cursor = 'zoom-in';
    img.style.transformOrigin = 'center center';
    img.style.transition = 'transform .15s ease';
    img.style.userSelect = 'none';

    function updateImage() {

        img.style.transform =
            `translate(${panX}px, ${panY}px) scale(${zoom})`;

        img.style.cursor =
            zoom > 1
                ? 'grab'
                : 'zoom-in';
    }

    // =========================
    // CLICK → ZOOM
    // =========================

    img.addEventListener(
        'click',
        event => {

            event.stopPropagation();

            if (zoom === 1) {

                zoom = 2;

            } else if (zoom < 8) {

                zoom = Math.min(
                    8,
                    zoom * 1.5
                );

            } else {

                zoom = 1;
                panX = 0;
                panY = 0;
            }

            updateImage();
        }
    );

    // =========================
    // MOUSE WHEEL → ZOOM
    // =========================

    viewport.addEventListener(
        'wheel',
        event => {

            event.preventDefault();
            event.stopPropagation();

            if (event.deltaY < 0) {

                zoom = Math.min(
                    8,
                    zoom + 0.5
                );

            } else {

                zoom = Math.max(
                    1,
                    zoom - 0.5
                );

                if (zoom === 1) {
                    panX = 0;
                    panY = 0;
                }
            }

            updateImage();
        },
        {
            passive: false
        }
    );

    // =========================
    // DRAG / PAN
    // =========================

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startPanX = 0;
    let startPanY = 0;

    viewport.addEventListener(
        'mousedown',
        event => {

            if (zoom <= 1) return;

            event.preventDefault();

            dragging = true;

            startX = event.clientX;
            startY = event.clientY;

            startPanX = panX;
            startPanY = panY;

            img.style.cursor = 'grabbing';
        }
    );

    window.addEventListener(
        'mousemove',
        event => {

            if (!dragging) return;

            panX =
                startPanX +
                (event.clientX - startX);

            panY =
                startPanY +
                (event.clientY - startY);

            updateImage();
        }
    );

    window.addEventListener(
        'mouseup',
        () => {

            if (!dragging) return;

            dragging = false;

            img.style.cursor =
                zoom > 1
                    ? 'grab'
                    : 'zoom-in';
        }
    );

    // =========================
    // DOUBLE CLICK → RESET
    // =========================

    img.addEventListener(
        'dblclick',
        event => {

            event.stopPropagation();

            zoom = 1;
            panX = 0;
            panY = 0;

            updateImage();
        }
    );

});

    /* =====================================================
       CLOSE BUTTON
    ===================================================== */

    const closeButton =
        viewer.querySelector(
            '#closeSatelliteTrueColor'
        );

    closeButton?.addEventListener(
        'click',
        () => {

            viewer.remove();

        }
    );


    /* =====================================================
       CLICK OUTSIDE
    ===================================================== */

    viewer.addEventListener(
        'click',
        event => {

            if (
                event.target ===
                viewer.firstElementChild
            ) {

                viewer.remove();

            }

        }
    );


    /* =====================================================
       ESC
    ===================================================== */

    function closeSatelliteViewer(
        event
    ) {

        if (
            event.key === 'Escape'
        ) {

            viewer.remove();

            document.removeEventListener(
                'keydown',
                closeSatelliteViewer
            );

        }

    }

    document.addEventListener(
        'keydown',
        closeSatelliteViewer
    );

}


// ======================================================
// بدء التشغيل
// ======================================================

document.addEventListener(
    'DOMContentLoaded',
    () => {

        console.log(
            '🌐 DOM loaded'
        );

        // ----------------------------------------------
        // تهيئة الخريطة
        // ----------------------------------------------

        initializeGISMap();

        // ----------------------------------------------
        // Case Selector
        // ----------------------------------------------

        const caseSelect =
            document.getElementById(
                'caseSelect'
            );

        if (caseSelect) {

            caseSelect.addEventListener(
                'change',
                function () {

                    console.log(
                        '🔽 Case selector changed:',
                        this.value
                    );

                    selectCase(
                        this.value
                    );

                }
            );

        } else {

            console.warn(
                '⚠️ Case selector not found'
            );

        }


// ----------------------------------------------
// Satellite / Drain Pipeline Button
// ----------------------------------------------

const downloadDrainsBtn =
    document.getElementById(
        'downloadDrainsBtn'
    );

if (downloadDrainsBtn) {

    downloadDrainsBtn.addEventListener(
        'click',
        runSatellitePipeline
    );

    console.log(
        '🛰️ Drain analysis button connected.'
    );

} else {

    console.warn(
        '⚠️ Drain analysis button not found.'
    );

}

        // ----------------------------------------------
        // تشغيل Dashboard
        // ----------------------------------------------

        initializeDashboard();

    }
);

