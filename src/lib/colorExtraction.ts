import type { Color, ExtractionConfidence } from "./database.types";

const CLUSTER_COUNT = 4;
const MAX_ITERATIONS = 20;
// Below this, a pixel is background or a soft edge blended with the background.
const MIN_ALPHA = 200;
const MIN_PIXELS = 20;
// A smaller color, like a logo, doesn't count as one of the item's colors.
const SECONDARY_MIN_SHARE = 0.15;
// An item is multicolor if no color reaches this share and at least 3 colors qualify.
const MULTICOLOR_MAX_TOP_SHARE = 0.4;
// A photo with no transparency still has its background, so its colors are less reliable.
const NO_CUTOUT_CONFIDENCE_FACTOR = 0.5;

// Example shades for each color name. Colors like gray need several, because a light
// gray and a dark gray are far apart. Gold and silver are left out because metallic
// shine doesn't reduce to one color, and light gray would often be called silver.
// Multicolor is decided from the mix of colors instead.
const REFERENCE_SHADES: Partial<Record<Color, string[]>> = {
  black: ["#101010", "#242424"],
  white: ["#FFFFFF", "#ECECE8"],
  gray: ["#4A4A4A", "#808080", "#B4B4B4", "#D2D2D2"],
  beige: ["#D9C8A9", "#E8DCC4", "#C2B280"],
  brown: ["#3D2B1F", "#6F4E37", "#9A6B44"],
  navy: ["#141E3C", "#1B2A49", "#26365F"],
  blue: ["#1F4E9E", "#3B6FB6", "#7DA7D9", "#B5D0EC"],
  teal: ["#0F5E5E", "#1F8A8A", "#5FB8B8"],
  green: ["#1E5B3A", "#2E8B57", "#7CC48D"],
  olive: ["#4B4F1F", "#6B6E2F", "#8F8F4A"],
  yellow: ["#F2D13C", "#F7E58A", "#C9A227"],
  orange: ["#E8792B", "#F4A261", "#B8541A"],
  red: ["#C8232C", "#E5484D", "#A01C24"],
  burgundy: ["#4A1020", "#6D1A2E", "#8B2C42"],
  pink: ["#EE9BB5", "#F7C6D4", "#D9477F"],
  purple: ["#3F2A6B", "#6E4A9E", "#B39DDB"],
};

type Lab = [number, number, number];
type Rgb = [number, number, number];

type Cluster = {
  center: Lab;
  rgb: Rgb;
  share: number;
};

export type ExtractedColors = {
  color_hex: string;
  primary_color: Color;
  secondary_colors: Color[];
  extraction_confidence: ExtractionConfidence;
};

// Distances in Lab are closer to how people see color differences than distances in
// RGB, so similar-looking shades end up grouped together.
function rgbToLab([red, green, blue]: Rgb): Lab {
  const toLinear = (value: number) => {
    const scaled = value / 255;
    return scaled <= 0.04045
      ? scaled / 12.92
      : Math.pow((scaled + 0.055) / 1.055, 2.4);
  };
  const r = toLinear(red);
  const g = toLinear(green);
  const b = toLinear(blue);

  const compress = (value: number) =>
    value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116;
  const x = compress((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
  const y = compress(0.2126 * r + 0.7152 * g + 0.0722 * b);
  const z = compress((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);

  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

function squaredDistance(a: Lab, b: Lab): number {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

function hexToRgb(hex: string): Rgb {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function rgbToHex(rgb: Rgb): string {
  const parts = rgb.map((value) =>
    Math.round(value).toString(16).padStart(2, "0"),
  );
  return `#${parts.join("").toUpperCase()}`;
}

const REFERENCE_POINTS = Object.entries(REFERENCE_SHADES).flatMap(
  ([name, shades]) =>
    shades.map((hex) => ({
      name: name as Color,
      lab: rgbToLab(hexToRgb(hex)),
    })),
);

function nearestColorName(lab: Lab): Color {
  let best = REFERENCE_POINTS[0];
  for (const point of REFERENCE_POINTS) {
    if (squaredDistance(lab, point.lab) < squaredDistance(lab, best.lab)) {
      best = point;
    }
  }
  return best.name;
}

function indexOfNearest(lab: Lab, centers: Lab[]): number {
  let bestIndex = 0;
  let bestDistance = Infinity;
  centers.forEach((center, index) => {
    const distance = squaredDistance(lab, center);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
}

// K-means is usually started from random points, which can give different answers on
// different runs. Starting with the pixel nearest the average, then repeatedly adding
// the pixel farthest from the chosen ones, means a photo always gets the same result.
function chooseStartingCenters(pixels: Lab[]): Lab[] {
  const mean: Lab = [0, 0, 0];
  for (const pixel of pixels) {
    mean[0] += pixel[0] / pixels.length;
    mean[1] += pixel[1] / pixels.length;
    mean[2] += pixel[2] / pixels.length;
  }

  const centers: Lab[] = [pixels[indexOfNearest(mean, pixels)]];
  while (centers.length < CLUSTER_COUNT) {
    let farthest = pixels[0];
    let farthestDistance = -1;
    for (const pixel of pixels) {
      const distance = squaredDistance(pixel, centers[indexOfNearest(pixel, centers)]);
      if (distance > farthestDistance) {
        farthestDistance = distance;
        farthest = pixel;
      }
    }
    centers.push(farthest);
  }
  return centers;
}

function kMeans(labs: Lab[], rgbs: Rgb[]): Cluster[] {
  let centers = chooseStartingCenters(labs);
  const assignments = new Array<number>(labs.length).fill(-1);

  // Repeat two steps until nothing moves: assign each pixel to its nearest center,
  // then move each center to the average of its pixels.
  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    let changed = false;
    labs.forEach((pixel, index) => {
      const nearest = indexOfNearest(pixel, centers);
      if (assignments[index] !== nearest) {
        assignments[index] = nearest;
        changed = true;
      }
    });
    if (!changed) break;

    const sums = centers.map(() => [0, 0, 0, 0]);
    labs.forEach((pixel, index) => {
      const sum = sums[assignments[index]];
      sum[0] += pixel[0];
      sum[1] += pixel[1];
      sum[2] += pixel[2];
      sum[3]++;
    });
    centers = centers.map((center, index) => {
      const [l, a, b, count] = sums[index];
      return count === 0 ? center : [l / count, a / count, b / count];
    });
  }

  const totals = centers.map(() => [0, 0, 0, 0]);
  rgbs.forEach((pixel, index) => {
    const total = totals[assignments[index]];
    total[0] += pixel[0];
    total[1] += pixel[1];
    total[2] += pixel[2];
    total[3]++;
  });

  return centers
    .map((center, index): Cluster => {
      const [red, green, blue, count] = totals[index];
      return {
        center,
        rgb: [red / (count || 1), green / (count || 1), blue / (count || 1)],
        share: count / labs.length,
      };
    })
    .filter((cluster) => cluster.share > 0)
    .sort((a, b) => b.share - a.share);
}

const roundConfidence = (value: number) => Math.round(value * 100) / 100;

/**
 * Finds an item's main colors from raw pixels, four values per pixel (red, green, blue,
 * alpha). Returns null if too few visible pixels remain to judge.
 */
export function extractColors(rgba: Uint8Array): ExtractedColors | null {
  const rgbs: Rgb[] = [];
  const labs: Lab[] = [];
  let hasTransparency = false;
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] < 255) hasTransparency = true;
    if (rgba[i + 3] < MIN_ALPHA) continue;
    const rgb: Rgb = [rgba[i], rgba[i + 1], rgba[i + 2]];
    rgbs.push(rgb);
    labs.push(rgbToLab(rgb));
  }
  if (labs.length < MIN_PIXELS) return null;

  const clusters = kMeans(labs, rgbs);

  // Shading can split one color into several clusters, such as the lit and shadowed
  // parts of a shirt, so add up clusters that share a color name.
  const nameShares = new Map<Color, number>();
  for (const cluster of clusters) {
    const name = nearestColorName(cluster.center);
    nameShares.set(name, (nameShares.get(name) ?? 0) + cluster.share);
  }
  const ranked = [...nameShares.entries()].sort((a, b) => b[1] - a[1]);
  const [topName, topShare] = ranked[0];
  const significant = ranked.filter(([, share]) => share >= SECONDARY_MIN_SHARE);

  const isMulticolor =
    topShare < MULTICOLOR_MAX_TOP_SHARE && significant.length >= 3;
  const secondaryEntries = isMulticolor ? significant : significant.slice(1);
  const secondaryShare = secondaryEntries.reduce(
    (sum, [, share]) => sum + share,
    0,
  );

  // The hex comes from the largest cluster with the winning name, so it's a shade
  // actually on the item rather than an average across different shades.
  const mainCluster =
    clusters.find((cluster) => nearestColorName(cluster.center) === topName) ??
    clusters[0];

  const factor = hasTransparency ? 1 : NO_CUTOUT_CONFIDENCE_FACTOR;
  const extraction_confidence: ExtractionConfidence = {
    primary_color: roundConfidence(
      (isMulticolor ? secondaryShare : topShare) * factor,
    ),
    color_hex: roundConfidence(mainCluster.share * factor),
  };
  if (secondaryEntries.length > 0) {
    extraction_confidence.secondary_colors = roundConfidence(
      secondaryShare * factor,
    );
  }

  return {
    color_hex: rgbToHex(mainCluster.rgb),
    primary_color: isMulticolor ? "multicolor" : topName,
    secondary_colors: secondaryEntries.map(([name]) => name),
    extraction_confidence,
  };
}
