# Crop-Classification-Using-Sentinel-1-SAR-Time-Series-and-Machine-Learning-Algorithms
Time‑series Sentinel‑1 SAR crop classification for Greater Noida using a 36‑band feature stack and Random Forest in Google Earth Engine.
# Crop Classification Using Sentinel-1 SAR Time-Series
### Greater Noida, Uttar Pradesh | Rabi 2023–24 | Random Forest | Google Earth Engine

---

## Project Overview

This project presents a crop classification framework for the Greater Noida
region using multi-temporal Sentinel-1 SAR data and a Random Forest classifier
implemented in Google Earth Engine. A 36-band time-series feature stack is built
across the Rabi 2023–24 season to capture the complete phenological cycle of
major crop types and classify them at 10 m spatial resolution, independent of
cloud cover or daylight conditions.

---

## Study Area

**Location:** Greater Noida, Uttar Pradesh, India
**Coordinates:** 77.45–77.55°E, 28.45–28.55°N
**Area:** 100 km² (10 km × 10 km)
**Season:** Rabi 2023–24 (October 2023 – March 2024)

---

## Crop Classes

| Class ID | Crop | Status |
|----------|------|--------|
| 0 | Wheat | Classified |
| 1 | Rice (Residual) | Classified |
| 2 | Maize | Pending — see note |
| 3 | Sugarcane | Classified |
| 4 | Fallow / Bare Soil | Classified |

> Maize polygon collection is in progress. Maize is primarily a Kharif crop
> and had minimal presence during the Rabi 2023–24 study period. Maize
> training data will be added in the next update using Kharif season imagery.
![Status](https://img.shields.io/badge/Status-Classification%20Complete-brightgreen)
![Accuracy](https://img.shields.io/badge/Overall%20Accuracy-98.77%25-blue)
![Kappa](https://img.shields.io/badge/Kappa-0.98-blue)
![Platform](https://img.shields.io/badge/Platform-Google%20Earth%20Engine-orange)
![Language](https://img.shields.io/badge/Language-JavaScript-yellow)
---

## Data Source

| Parameter | Value |
|-----------|-------|
| Satellite | Sentinel-1 (ESA Copernicus) |
| Product | GRD — Ground Range Detected, Level-1 |
| Polarization | Dual-pol VV / VH |
| Resolution | 10 metres |
| Orbit | Descending pass |
| Mode | Interferometric Wide Swath (IW) |
| Total Images | 27 acquisitions (Oct 2023 – Mar 2024) |

---

## Methodology

### 7-Stage Preprocessing Pipeline

| Stage | Process | Output |
|-------|---------|--------|
| 1. Raw Acquisition | Sentinel-1 GRD filtered by spatial bounds, date, IW mode, descending orbit, VV/VH polarization | 27 dual-pol images |
| 2. Calibration | Conversion to sigma-naught σ° in dB scale, pre-applied by ESA during GRD processing | Calibrated backscatter (−30 to +5 dB) |
| 3. Speckle Filtering | Focal median filter with 50 m circular kernel on VV and VH bands independently | Smoothed SAR images |
| 4. Compositing | Temporal mean within each 15-day window across 12 periods (T01–T12) | 12 bi-weekly composites |
| 5. Ratio Calculation | Bands converted from dB to linear scale; VV_lin / VH_lin per time step | 12 depolarization ratio bands |
| 6. Stacking | 12 VV + 12 VH + 12 Ratio bands assembled into one image | 36-band time-series stack |
| 7. Clipping | Stack clipped to study area boundary, exported as GeoTIFF | Analysis-ready dataset |

### Bi-Weekly Composite Schedule

| Composite | Period | Representative Date |
|-----------|--------|-------------------|
| T01 | Oct 01–15 | Oct 08 |
| T02 | Oct 16–31 | Oct 23 |
| T03 | Nov 01–15 | Nov 08 |
| T04 | Nov 16–30 | Nov 23 |
| T05 | Dec 01–15 | Dec 08 |
| T06 | Dec 16–31 | Dec 23 |
| T07 | Jan 01–15 | Jan 08 |
| T08 | Jan 16–31 | Jan 23 |
| T09 | Feb 01–15 | Feb 08 |
| T10 | Feb 16–28 | Feb 23 |
| T11 | Mar 01–15 | Mar 08 |
| T12 | Mar 16–31 | Mar 23 |

### Random Forest Parameters

| Parameter | Value |
|-----------|-------|
| Number of Trees | 100 |
| Variables per Split | 6 (= √36 features) |
| Minimum Leaf Population | 5 |
| Bag Fraction | 0.7 |
| Random Seed | 42 |
| Train / Test Split | 70% / 30% |

---

## Training Data

| Crop Class | Polygons Drawn | Pixel Samples | Train (70%) | Test (30%) |
|------------|---------------|---------------|-------------|------------|
| Wheat | 14 | ~798 | ~559 | ~239 |
| Rice | 8 | ~228 | ~160 | ~68 |
| Maize | 0 | 0 | 0 | 0 |
| Sugarcane | 9 | ~513 | ~359 | ~154 |
| Fallow Land | 10 | ~360 | ~252 | ~108 |
| **Total** | **33** | **1899** | **1329** | **570** |

---

## Results

### Overall Accuracy

| Metric | Value |
|--------|-------|
| Overall Accuracy (OA) | 98.77% |
| Kappa Coefficient (κ) | 0.98 |
| Total Test Samples | 570 |
| Correctly Classified | 563 |

### Per-Class Accuracy

| Crop Class | PA (%) | UA (%) | F1 Score |
|------------|--------|--------|----------|
| Wheat | 100.00 | 96.45 | 0.982 |
| Rice | 98.21 | 100.00 | 0.991 |
| Maize | — | — | — |
| Sugarcane | 98.67 | 100.00 | 0.993 |
| Fallow Land | 96.30 | 100.00 | 0.981 |

> PA = Producer's Accuracy, UA = User's Accuracy
> Maize excluded — insufficient Rabi season training samples

---
## How to Run

1. Open Google Earth Engine: https://code.earthengine.google.com
2. Create a new script and paste the contents of
   `code/TimeSeries_CropClassification_v1.js`
3. In Geometry Imports create 5 FeatureCollections with these names and crop values:

| Layer Name | Crop Value | Crop Type |
|------------|------------|-----------|
| wheat | 0 | Wheat |
| rice | 1 | Rice (Residual) |
| maize | 2 | Maize |
| sugarcane | 3 | Sugarcane |
| fallow | 4 | Fallow / Bare Soil |

4. For each layer click the gear icon and add a property:
   - Property name: `crop`
   - Property value: as listed in the table above

5. Draw training polygons on each layer over the study area
   (target 15–20 polygons per class minimum)

6. Click **Save** then **Run**

7. Wait 60–90 seconds for the script to complete

8. Check the **Console** tab for:
   - Total training polygons
   - Total pixel samples
   - Train and test set sizes
   - Overall Accuracy
   - Kappa Coefficient
   - Per-class Producer and User Accuracy

9. Click the **Tasks** tab and click **Run** next to
   `CropMap_GreaterNoida_RF` to export the final
   crop map to Google Drive under folder `GEE_Exports`


