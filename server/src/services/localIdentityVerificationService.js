import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import * as tf from "@tensorflow/tfjs";
import * as faceapi from "@vladmandic/face-api";
import { Canvas, Image, ImageData, loadImage } from "canvas";
import { createWorker } from "tesseract.js";

faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FACE_MODEL_DIR = path.resolve(__dirname, "../../assets/face-models");
const TESSDATA_DIR = path.resolve(__dirname, "../../assets/tessdata");
const IMAGE_FETCH_TIMEOUT_MS = Number(process.env.IDENTITY_IMAGE_FETCH_TIMEOUT_MS || 15000);
const FACE_MATCH_THRESHOLD = Number(process.env.IDENTITY_FACE_MATCH_THRESHOLD || 0.5);

let modelLoadPromise = null;
let ocrWorkerPromise = null;

function buildFailure(reason, details = {}) {
  return {
    ok: false,
    reason,
    ...details,
  };
}

function resolveImageSource(source) {
  if (typeof source !== "string" || !source.trim()) {
    throw new Error("Image source is required");
  }

  return source.trim();
}

async function fetchImageBuffer(source) {
  const normalized = resolveImageSource(source);

  if (normalized.startsWith("data:")) {
    const separator = normalized.indexOf(",");

    if (separator === -1) {
      throw new Error("Invalid data URL image");
    }

    return Buffer.from(normalized.slice(separator + 1), "base64");
  }

  if (/^https?:\/\//i.test(normalized)) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(normalized, { signal: controller.signal });

      if (!response.ok) {
        throw new Error(`Image download failed with status ${response.status}`);
      }

      return Buffer.from(await response.arrayBuffer());
    } finally {
      clearTimeout(timer);
    }
  }

  return fs.readFile(normalized);
}

async function ensurePngBuffer(buffer, width = 1800) {
  return sharp(buffer)
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .png()
    .toBuffer();
}

async function buildOcrBuffer(buffer) {
  return sharp(buffer)
    .rotate()
    .resize({ width: 2200, withoutEnlargement: true })
    .grayscale()
    .normalize()
    .sharpen()
    .png()
    .toBuffer();
}

async function getOcrWorker() {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = createWorker("eng", 1, {
      langPath: TESSDATA_DIR,
      gzip: true,
    });
  }

  return ocrWorkerPromise;
}

function normalizeCnicOcrText(text) {
  return String(text || "")
    .replace(/[OoQqD]/g, "0")
    .replace(/[Il|!]/g, "1")
    .replace(/[Zz]/g, "2")
    .replace(/[Ss]/g, "5")
    .replace(/[Bb]/g, "8");
}

function extractCnicCandidates(text) {
  const normalized = normalizeCnicOcrText(text);
  const compact = normalized.replace(/[^0-9]/g, "");
  const candidates = new Set();

  for (const match of normalized.matchAll(/\d{5}\D*\d{7}\D*\d/g)) {
    const digits = match[0].replace(/\D/g, "");

    if (digits.length === 13) {
      candidates.add(digits);
    }
  }

  for (let index = 0; index <= compact.length - 13; index += 1) {
    candidates.add(compact.slice(index, index + 13));
  }

  return [...candidates].filter((value) => /^\d{13}$/.test(value));
}

async function extractBestCnicFromImage(buffer) {
  const worker = await getOcrWorker();
  const ocrBuffer = await buildOcrBuffer(buffer);
  const result = await worker.recognize(ocrBuffer);
  const text = result?.data?.text || "";
  const candidates = extractCnicCandidates(text);

  return {
    text,
    candidates,
    extractedCnic: candidates[0] || null,
  };
}

async function loadFaceModels() {
  if (!modelLoadPromise) {
    modelLoadPromise = (async () => {
      await tf.setBackend("cpu");
      await tf.ready();
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromDisk(FACE_MODEL_DIR),
        faceapi.nets.faceLandmark68TinyNet.loadFromDisk(FACE_MODEL_DIR),
        faceapi.nets.faceRecognitionNet.loadFromDisk(FACE_MODEL_DIR),
      ]);
    })();
  }

  await modelLoadPromise;
}

function documentRegions(width, height) {
  const toRegion = (left, top, regionWidth, regionHeight) => ({
    left: Math.max(0, Math.round(left * width)),
    top: Math.max(0, Math.round(top * height)),
    width: Math.max(1, Math.round(regionWidth * width)),
    height: Math.max(1, Math.round(regionHeight * height)),
  });

  return [
    null,
    toRegion(0, 0, 0.58, 1),
    toRegion(0.42, 0, 0.58, 1),
    toRegion(0.03, 0.12, 0.52, 0.78),
    toRegion(0.45, 0.12, 0.52, 0.78),
    toRegion(0.02, 0.24, 0.46, 0.68),
    toRegion(0.52, 0.24, 0.46, 0.68),
  ];
}

async function describeFaceFromImageBuffer(buffer, mode = "selfie") {
  await loadFaceModels();

  const normalizedBuffer = await ensurePngBuffer(buffer, mode === "document" ? 1600 : 1200);
  const image = await loadImage(normalizedBuffer);
  const detectorOptions = new faceapi.TinyFaceDetectorOptions({
    inputSize: mode === "document" ? 512 : 416,
    scoreThreshold: 0.3,
  });

  if (mode !== "document") {
    const detection = await faceapi
      .detectSingleFace(image, detectorOptions)
      .withFaceLandmarks(true)
      .withFaceDescriptor();

    return detection || null;
  }

  const metadata = await sharp(normalizedBuffer).metadata();
  const width = metadata.width || 0;
  const height = metadata.height || 0;

  if (!width || !height) {
    return null;
  }

  let bestDetection = null;

  for (const region of documentRegions(width, height)) {
    const candidateBuffer = region
      ? await sharp(normalizedBuffer)
          .extract(region)
          .png()
          .toBuffer()
      : normalizedBuffer;
    const candidateImage = region ? await loadImage(candidateBuffer) : image;
    const detection = await faceapi
      .detectSingleFace(candidateImage, detectorOptions)
      .withFaceLandmarks(true)
      .withFaceDescriptor();

    if (!detection) {
      continue;
    }

    if (!bestDetection || detection.detection.score > bestDetection.detection.score) {
      bestDetection = detection;
    }
  }

  return bestDetection;
}

function cosineSimilarity(firstDescriptor, secondDescriptor) {
  let dot = 0;
  let firstMagnitude = 0;
  let secondMagnitude = 0;

  for (let index = 0; index < firstDescriptor.length; index += 1) {
    const left = firstDescriptor[index];
    const right = secondDescriptor[index];
    dot += left * right;
    firstMagnitude += left * left;
    secondMagnitude += right * right;
  }

  const denominator = Math.sqrt(firstMagnitude) * Math.sqrt(secondMagnitude);
  return denominator > 0 ? dot / denominator : 0;
}

export async function verifyProviderIdentityLocally({ cnic, cnicFrontImage, cnicBackImage, selfieImage }) {
  let cnicFrontBuffer;
  let cnicBackBuffer;
  let selfieBuffer;

  try {
    [cnicFrontBuffer, cnicBackBuffer, selfieBuffer] = await Promise.all([
      fetchImageBuffer(cnicFrontImage),
      fetchImageBuffer(cnicBackImage),
      fetchImageBuffer(selfieImage),
    ]);
  } catch (error) {
    return buildFailure("Unable to read uploaded identity images", {
      provider: "local_phase_1",
      details: error.message,
    });
  }

  let frontOcr;
  let backOcr;

  try {
    [frontOcr, backOcr] = await Promise.all([
      extractBestCnicFromImage(cnicFrontBuffer),
      extractBestCnicFromImage(cnicBackBuffer),
    ]);
  } catch (error) {
    return buildFailure("Unable to read the CNIC text from the uploaded images", {
      provider: "local_phase_1",
      details: error.message,
    });
  }

  const expectedCnic = String(cnic || "").replace(/\D/g, "");
  const matchedCandidate =
    frontOcr.candidates.find((value) => value === expectedCnic) ||
    backOcr.candidates.find((value) => value === expectedCnic) ||
    null;
  const extractedCnic = matchedCandidate || frontOcr.extractedCnic || backOcr.extractedCnic || null;

  if (!matchedCandidate) {
    return buildFailure(
      extractedCnic
        ? "Entered CNIC number does not match the uploaded CNIC images"
        : "Could not read a valid CNIC number from the uploaded images",
      {
        provider: "local_phase_1",
        extractedCnic,
      }
    );
  }

  let cnicFace;
  let selfieFace;

  try {
    [cnicFace, selfieFace] = await Promise.all([
      describeFaceFromImageBuffer(cnicFrontBuffer, "document"),
      describeFaceFromImageBuffer(selfieBuffer, "selfie"),
    ]);
  } catch (error) {
    return buildFailure("Face verification failed while processing the uploaded images", {
      provider: "local_phase_1",
      extractedCnic,
      details: error.message,
    });
  }

  if (!cnicFace) {
    return buildFailure("No clear face was detected on the CNIC front image", {
      provider: "local_phase_1",
      extractedCnic,
    });
  }

  if (!selfieFace) {
    return buildFailure("No clear face was detected in the captured selfie", {
      provider: "local_phase_1",
      extractedCnic,
    });
  }

  const faceSimilarity = Number(
    cosineSimilarity(cnicFace.descriptor, selfieFace.descriptor).toFixed(4)
  );

  if (!Number.isFinite(faceSimilarity) || faceSimilarity < FACE_MATCH_THRESHOLD) {
    return buildFailure("The captured selfie does not match the CNIC photo", {
      provider: "local_phase_1",
      extractedCnic,
      faceSimilarity: Number.isFinite(faceSimilarity) ? faceSimilarity : 0,
    });
  }

  return {
    ok: true,
    provider: "local_phase_1",
    extractedCnic,
    faceSimilarity,
  };
}
