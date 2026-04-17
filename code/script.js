// ============================================================
// CROP CLASSIFICATION USING SENTINEL-1 SAR TIME-SERIES
// Greater Noida | Rabi 2023-24 | Random Forest
// ============================================================

// ------------------------------------------------------------
// STEP 1: STUDY AREA & DATES
// ------------------------------------------------------------
var studyArea = ee.Geometry.Rectangle([77.45, 28.45, 77.55, 28.55]);
var startDate = '2023-10-01';
var endDate   = '2024-03-31';

Map.centerObject(studyArea, 11);
Map.addLayer(studyArea, {color: 'red'}, 'Study Area');

// ------------------------------------------------------------
// STEP 2: LOAD SENTINEL-1 GRD
// ------------------------------------------------------------
var s1 = ee.ImageCollection('COPERNICUS/S1_GRD')
  .filterBounds(studyArea)
  .filterDate(startDate, endDate)
  .filter(ee.Filter.eq('instrumentMode', 'IW'))
  .filter(ee.Filter.eq('orbitProperties_pass', 'DESCENDING'))
  .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
  .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'));

// ------------------------------------------------------------
// STEP 3: SPECKLE FILTER FUNCTION
// ------------------------------------------------------------
var speckleFilter = function(image) {
  var vv = image.select('VV');
  var vh = image.select('VH');
  var vv_filt = vv.focal_median({
    radius: 50,
    kernelType: 'circle',
    units: 'meters'
  });
  var vh_filt = vh.focal_median({
    radius: 50,
    kernelType: 'circle',
    units: 'meters'
  });
  return image
    .addBands(vv_filt.rename('VV_filt'))
    .addBands(vh_filt.rename('VH_filt'));
};

var s1_filtered = s1.map(speckleFilter);

// ------------------------------------------------------------
// STEP 4: BI-WEEKLY COMPOSITE FUNCTION
// ------------------------------------------------------------
var createComposite = function(start, label) {
  var end = ee.Date(start).advance(15, 'day');
  var subset = s1_filtered
    .filterDate(start, end)
    .select(['VV_filt', 'VH_filt']);

  // Use mean of all images in 15-day window
  var composite = subset.mean().clip(studyArea);

  // Convert dB to linear scale
  var vv_lin = ee.Image(10)
    .pow(composite.select('VV_filt').divide(10))
    .rename('VV_' + label);
  var vh_lin = ee.Image(10)
    .pow(composite.select('VH_filt').divide(10))
    .rename('VH_' + label);

  // VV/VH ratio
  var ratio = vv_lin.divide(vh_lin)
    .rename('Ratio_' + label);

  return vv_lin.addBands(vh_lin).addBands(ratio);
};

// ------------------------------------------------------------
// STEP 5: CREATE 12 BI-WEEKLY COMPOSITES (T01 to T12)
// T01 = Oct 1-15  | T02 = Oct 16-31
// T03 = Nov 1-15  | T04 = Nov 16-30
// T05 = Dec 1-15  | T06 = Dec 16-31
// T07 = Jan 1-15  | T08 = Jan 16-31
// T09 = Feb 1-15  | T10 = Feb 16-28
// T11 = Mar 1-15  | T12 = Mar 16-31
// ------------------------------------------------------------
var c01 = createComposite('2023-10-01', 'T01');
var c02 = createComposite('2023-10-16', 'T02');
var c03 = createComposite('2023-11-01', 'T03');
var c04 = createComposite('2023-11-16', 'T04');
var c05 = createComposite('2023-12-01', 'T05');
var c06 = createComposite('2023-12-16', 'T06');
var c07 = createComposite('2024-01-01', 'T07');
var c08 = createComposite('2024-01-16', 'T08');
var c09 = createComposite('2024-02-01', 'T09');
var c10 = createComposite('2024-02-16', 'T10');
var c11 = createComposite('2024-03-01', 'T11');
var c12 = createComposite('2024-03-16', 'T12');

// ------------------------------------------------------------
// STEP 6: STACK INTO 36-BAND TIME-SERIES IMAGE
// 12 VV + 12 VH + 12 Ratio = 36 bands total
// ------------------------------------------------------------
var timeSeriesStack = c01
  .addBands(c02).addBands(c03).addBands(c04)
  .addBands(c05).addBands(c06).addBands(c07)
  .addBands(c08).addBands(c09).addBands(c10)
  .addBands(c11).addBands(c12)
  .clip(studyArea);

print('Number of composites: 12');
print('Time-series stack (36 bands):', timeSeriesStack);
print('Band names:', timeSeriesStack.bandNames());

// Visualise T06 VV composite (mid-season check)
Map.addLayer(
  timeSeriesStack.select('VV_T06'),
  {min: 0, max: 0.3},
  'VV T06 Mid-Season',
  false
);
// preview layers
Map.addLayer(timeSeriesStack.select('VV_T01'),
  {min:0, max:0.3}, 'VV T01 Early', false);
Map.addLayer(timeSeriesStack.select('VV_T06'),
  {min:0, max:0.3}, 'VV T06 Mid', false);
Map.addLayer(timeSeriesStack.select('VV_T12'),
  {min:0, max:0.3}, 'VV T12 Late', false);
Map.addLayer(timeSeriesStack.select('Ratio_T06'),
  {min:0, max:5}, 'Ratio T06 Mid', false);

// ------------------------------------------------------------
// STEP 7: MERGE ALL TRAINING POLYGONS
// ------------------------------------------------------------
var trainingPolygons = wheat
  .merge(rice)
  .merge(maize)
  .merge(sugarcane)
  .merge(fallow);

print('Total training polygons:', trainingPolygons.size());

// ------------------------------------------------------------
// STEP 8: SAMPLE FEATURES FROM STACK
// ------------------------------------------------------------
var samples = timeSeriesStack.sampleRegions({
  collection: trainingPolygons,
  properties: ['crop'],
  scale: 10,
  tileScale: 4
});

print('Total samples:', samples.size());

// ------------------------------------------------------------
// STEP 9: SPLIT 70% TRAIN / 30% TEST
// ------------------------------------------------------------
var withRandom = samples.randomColumn('random');
var trainSet = withRandom.filter(ee.Filter.lt('random', 0.7));
var testSet  = withRandom.filter(ee.Filter.gte('random', 0.7));

print('Train size:', trainSet.size());
print('Test size:', testSet.size());

// ------------------------------------------------------------
// STEP 10: TRAIN RANDOM FOREST (100 trees)
// ------------------------------------------------------------
var bands = timeSeriesStack.bandNames();

var classifier = ee.Classifier.smileRandomForest({
  numberOfTrees: 100,
  variablesPerSplit: 6,
  minLeafPopulation: 5,
  bagFraction: 0.7,
  seed: 42
}).train({
  features: trainSet,
  classProperty: 'crop',
  inputProperties: bands
});

print('Random Forest trained successfully!');

// ------------------------------------------------------------
// STEP 11: CLASSIFY FULL STUDY AREA
// ------------------------------------------------------------
var classified = timeSeriesStack
  .classify(classifier)
  .clip(studyArea);

// Colour palette:
// 0=Wheat (gold)
// 1=Rice (blue)
// 2=Maize (orange)
// 3=Sugarcane (dark green)
// 4=Fallow (tan)
Map.addLayer(classified, {
  min: 0,
  max: 4,
  palette: ['#FFD700', '#0000FF', '#FF6600', '#006400', '#D2B48C']
}, 'Crop Classification Map');

// ------------------------------------------------------------
// STEP 12: ACCURACY ASSESSMENT
// ------------------------------------------------------------
var validated = testSet.classify(classifier);
var confMatrix = validated.errorMatrix('crop', 'classification');

print('======= ACCURACY RESULTS =======');
print('Confusion Matrix:', confMatrix);
print('Overall Accuracy:', confMatrix.accuracy());
print('Kappa Coefficient:', confMatrix.kappa());
print('Producers Accuracy (per class):', confMatrix.producersAccuracy());
print('Users Accuracy (per class):', confMatrix.consumersAccuracy());

// ------------------------------------------------------------
// STEP 13: EXPORT CROP MAP TO GOOGLE DRIVE
// ------------------------------------------------------------
Export.image.toDrive({
  image: classified,
  description: 'CropMap_GreaterNoida_RF',
  folder: 'GEE_Exports',
  fileNamePrefix: 'CropMap_GreaterNoida',
  scale: 10,
  region: studyArea,
  crs: 'EPSG:4326',
  maxPixels: 1e13
});