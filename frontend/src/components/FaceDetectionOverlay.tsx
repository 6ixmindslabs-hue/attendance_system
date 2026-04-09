import { useEffect, useRef } from 'react';
import type Webcam from 'react-webcam';
import { FaceDetector, FilesetResolver, type Detection } from '@mediapipe/tasks-vision';

const WASM_ROOT = `${import.meta.env.BASE_URL}mediapipe`;
const MODEL_ASSET_PATH = `${import.meta.env.BASE_URL}models/blaze_face_short_range.tflite`;
const DETECTION_INTERVAL_MS = 120;
const DETECTION_MAX_EDGE = 640;
const MIN_LOCK_FACE_AREA_RATIO = 0.055;
const MAX_FACE_AREA_RATIO = 0.3;
const CENTER_TOLERANCE_X = 0.14;
const CENTER_TOLERANCE_Y = 0.18;
const MIN_FACE_BRIGHTNESS = 0.2;
const BOX_SMOOTHING = 0.34;

export type FaceOverlayStatus =
  | 'loading'
  | 'locked'
  | 'no_face'
  | 'multiple_faces'
  | 'move_closer'
  | 'move_back'
  | 'center_face'
  | 'increase_lighting'
  | 'adjusting'
  | 'error';

export type FaceOverlayTone = 'green' | 'yellow' | 'red';

export type FaceOverlaySnapshot = {
  status: FaceOverlayStatus;
  tone: FaceOverlayTone;
  message: string;
  readyForCapture: boolean;
  hasFace: boolean;
  faceCount: number;
  confidence: number | null;
  brightness: number | null;
};

type DisplayBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  tone: FaceOverlayTone;
  label: string;
};

type RenderState = {
  boxes: DisplayBox[];
};

type FaceDetectionOverlayProps = {
  webcamRef: React.RefObject<Webcam | null>;
  active: boolean;
  onStateChange?: (state: FaceOverlaySnapshot) => void;
};

const DEFAULT_RENDER_STATE: RenderState = {
  boxes: []
};

const DEFAULT_FACE_OVERLAY_STATE: FaceOverlaySnapshot = {
  status: 'loading',
  tone: 'yellow',
  message: 'Loading face detector...',
  readyForCapture: false,
  hasFace: false,
  faceCount: 0,
  confidence: null,
  brightness: null
};

const getTonePalette = (tone: FaceOverlayTone) => {
  if (tone === 'green') {
    return {
      stroke: '#22c55e',
      glow: 'rgba(34, 197, 94, 0.45)',
      fill: 'rgba(34, 197, 94, 0.18)',
      label: '#14532d'
    };
  }

  if (tone === 'yellow') {
    return {
      stroke: '#f59e0b',
      glow: 'rgba(245, 158, 11, 0.4)',
      fill: 'rgba(245, 158, 11, 0.16)',
      label: '#78350f'
    };
  }

  return {
    stroke: '#ef4444',
    glow: 'rgba(239, 68, 68, 0.42)',
    fill: 'rgba(239, 68, 68, 0.16)',
    label: '#7f1d1d'
  };
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const rounded = (value: number, digits = 0) => Number(value.toFixed(digits));

const createProcessSize = (videoWidth: number, videoHeight: number) => {
  const aspectRatio = videoWidth / Math.max(videoHeight, 1);

  if (aspectRatio >= 1) {
    return {
      width: DETECTION_MAX_EDGE,
      height: Math.max(1, Math.round(DETECTION_MAX_EDGE / aspectRatio))
    };
  }

  return {
    width: Math.max(1, Math.round(DETECTION_MAX_EDGE * aspectRatio)),
    height: DETECTION_MAX_EDGE
  };
};

const drawRoundedRect = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) => {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
};

const getDetectionConfidence = (detection: Detection) => (
  detection.categories[0]?.score ?? detection.categories.find((category) => typeof category.score === 'number')?.score ?? 0
);

const getFaceBrightness = (
  processContext: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  canvasWidth: number,
  canvasHeight: number
) => {
  const sampleX = clamp(Math.floor(x), 0, canvasWidth - 1);
  const sampleY = clamp(Math.floor(y), 0, canvasHeight - 1);
  const sampleWidth = clamp(Math.floor(width), 1, canvasWidth - sampleX);
  const sampleHeight = clamp(Math.floor(height), 1, canvasHeight - sampleY);
  const imageData = processContext.getImageData(sampleX, sampleY, sampleWidth, sampleHeight).data;
  const step = Math.max(1, Math.floor(Math.min(sampleWidth, sampleHeight) / 18));

  let luminanceTotal = 0;
  let pixelCount = 0;

  for (let row = 0; row < sampleHeight; row += step) {
    for (let column = 0; column < sampleWidth; column += step) {
      const pixelIndex = ((row * sampleWidth) + column) * 4;
      const red = imageData[pixelIndex];
      const green = imageData[pixelIndex + 1];
      const blue = imageData[pixelIndex + 2];

      luminanceTotal += (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
      pixelCount += 1;
    }
  }

  return pixelCount > 0 ? luminanceTotal / (pixelCount * 255) : 0;
};

const lerpBox = (previous: DisplayBox | null, next: DisplayBox) => {
  if (!previous) {
    return next;
  }

  return {
    ...next,
    x: previous.x + ((next.x - previous.x) * BOX_SMOOTHING),
    y: previous.y + ((next.y - previous.y) * BOX_SMOOTHING),
    width: previous.width + ((next.width - previous.width) * BOX_SMOOTHING),
    height: previous.height + ((next.height - previous.height) * BOX_SMOOTHING)
  };
};

const getCoverTransform = (sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number) => {
  const coverScale = Math.max(targetWidth / Math.max(sourceWidth, 1), targetHeight / Math.max(sourceHeight, 1));
  const renderedWidth = sourceWidth * coverScale;
  const renderedHeight = sourceHeight * coverScale;

  return {
    coverScale,
    offsetX: (targetWidth - renderedWidth) / 2,
    offsetY: (targetHeight - renderedHeight) / 2
  };
};

const buildDetectionState = ({
  faceCount,
  areaRatio,
  centerOffsetX,
  centerOffsetY,
  brightness,
  confidence
}: {
  faceCount: number;
  areaRatio: number;
  centerOffsetX: number;
  centerOffsetY: number;
  brightness: number;
  confidence: number;
}): FaceOverlaySnapshot => {
  if (faceCount === 0) {
    return {
      status: 'no_face',
      tone: 'red',
      message: 'No face detected. Please look at the camera.',
      readyForCapture: false,
      hasFace: false,
      faceCount,
      confidence: null,
      brightness: null
    };
  }

  if (faceCount > 1) {
    return {
      status: 'multiple_faces',
      tone: 'red',
      message: 'Multiple faces detected. Only one person should be in front of the camera.',
      readyForCapture: false,
      hasFace: true,
      faceCount,
      confidence,
      brightness
    };
  }

  if (brightness < MIN_FACE_BRIGHTNESS) {
    return {
      status: 'increase_lighting',
      tone: 'yellow',
      message: 'Increase lighting so your face is brighter and easier to read.',
      readyForCapture: false,
      hasFace: true,
      faceCount,
      confidence,
      brightness
    };
  }

  if (areaRatio < MIN_LOCK_FACE_AREA_RATIO) {
    return {
      status: 'move_closer',
      tone: 'yellow',
      message: 'Move closer so your face fills more of the frame.',
      readyForCapture: false,
      hasFace: true,
      faceCount,
      confidence,
      brightness
    };
  }

  if (areaRatio > MAX_FACE_AREA_RATIO) {
    return {
      status: 'move_back',
      tone: 'yellow',
      message: 'Move back slightly so your full face stays inside the frame.',
      readyForCapture: false,
      hasFace: true,
      faceCount,
      confidence,
      brightness
    };
  }

  if (centerOffsetX > CENTER_TOLERANCE_X || centerOffsetY > CENTER_TOLERANCE_Y) {
    return {
      status: 'center_face',
      tone: 'yellow',
      message: 'Center your face in front of the camera.',
      readyForCapture: false,
      hasFace: true,
      faceCount,
      confidence,
      brightness
    };
  }

  if (confidence < 0.72) {
    return {
      status: 'adjusting',
      tone: 'yellow',
      message: 'Hold still while the tracker refines your face box.',
      readyForCapture: false,
      hasFace: true,
      faceCount,
      confidence,
      brightness
    };
  }

  return {
    status: 'locked',
    tone: 'green',
    message: 'Face locked. Hold steady for attendance verification.',
    readyForCapture: true,
    hasFace: true,
    faceCount,
    confidence,
    brightness
  };
};

const publishStateKey = (state: FaceOverlaySnapshot) => [
  state.status,
  state.faceCount,
  state.readyForCapture ? '1' : '0',
  state.confidence === null ? 'na' : rounded(state.confidence, 2),
  state.brightness === null ? 'na' : rounded(state.brightness, 2)
].join(':');

export default function FaceDetectionOverlay({
  webcamRef,
  active,
  onStateChange
}: FaceDetectionOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const detectorRef = useRef<FaceDetector | null>(null);
  const processCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const smoothedBoxRef = useRef<DisplayBox | null>(null);
  const renderStateRef = useRef<RenderState>(DEFAULT_RENDER_STATE);
  const animationFrameRef = useRef<number | null>(null);
  const lastProcessedAtRef = useRef(0);
  const lastVideoTimeRef = useRef(-1);
  const latestStateKeyRef = useRef('');

  useEffect(() => {
    let cancelled = false;

    const loadDetector = async () => {
      onStateChange?.(DEFAULT_FACE_OVERLAY_STATE);

      try {
        const wasmFiles = await FilesetResolver.forVisionTasks(WASM_ROOT);
        const detector = await FaceDetector.createFromOptions(wasmFiles, {
          baseOptions: {
            modelAssetPath: MODEL_ASSET_PATH
          },
          runningMode: 'VIDEO',
          minDetectionConfidence: 0.55,
          minSuppressionThreshold: 0.35
        });

        if (cancelled) {
          detector.close();
          return;
        }

        detectorRef.current = detector;
      } catch (error) {
        console.error('Face detector setup failed:', error);

        onStateChange?.({
          status: 'error',
          tone: 'red',
          message: 'Face detector could not be loaded. Please refresh the kiosk.',
          readyForCapture: false,
          hasFace: false,
          faceCount: 0,
          confidence: null,
          brightness: null
        });
      }
    };

    void loadDetector();

    return () => {
      cancelled = true;
      detectorRef.current?.close();
      detectorRef.current = null;
    };
  }, [onStateChange]);

  useEffect(() => {
    if (!active) {
      const canvas = canvasRef.current;
      const context = canvas?.getContext('2d');
      if (canvas && context) {
        context.clearRect(0, 0, canvas.width, canvas.height);
      }
      renderStateRef.current = DEFAULT_RENDER_STATE;
      smoothedBoxRef.current = null;
      return;
    }

    const drawFrame = (time: number) => {
      const canvas = canvasRef.current;
      const video = webcamRef.current?.video;

      if (!canvas) {
        animationFrameRef.current = window.requestAnimationFrame(drawFrame);
        return;
      }

      const context = canvas.getContext('2d');

      if (!context) {
        animationFrameRef.current = window.requestAnimationFrame(drawFrame);
        return;
      }

      const displayWidth = canvas.clientWidth || canvas.parentElement?.clientWidth || 0;
      const displayHeight = canvas.clientHeight || canvas.parentElement?.clientHeight || 0;
      const devicePixelRatio = window.devicePixelRatio || 1;
      const targetWidth = Math.max(1, Math.round(displayWidth * devicePixelRatio));
      const targetHeight = Math.max(1, Math.round(displayHeight * devicePixelRatio));

      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
      }

      context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      context.clearRect(0, 0, displayWidth, displayHeight);

      if (!detectorRef.current || !video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
        animationFrameRef.current = window.requestAnimationFrame(drawFrame);
        return;
      }

      if ((time - lastProcessedAtRef.current) >= DETECTION_INTERVAL_MS && video.currentTime !== lastVideoTimeRef.current) {
        const processCanvas = processCanvasRef.current || document.createElement('canvas');
        processCanvasRef.current = processCanvas;

        const processSize = createProcessSize(video.videoWidth, video.videoHeight);
        processCanvas.width = processSize.width;
        processCanvas.height = processSize.height;

        const processContext = processCanvas.getContext('2d', { willReadFrequently: true });

        if (processContext) {
          processContext.drawImage(video, 0, 0, processSize.width, processSize.height);

          const detections = detectorRef.current.detectForVideo(processCanvas, time).detections
            .filter((detection) => Boolean(detection.boundingBox))
            .sort((left, right) => getDetectionConfidence(right) - getDetectionConfidence(left));

          const { coverScale, offsetX, offsetY } = getCoverTransform(video.videoWidth, video.videoHeight, displayWidth, displayHeight);
          const sourceScaleX = video.videoWidth / Math.max(processSize.width, 1);
          const sourceScaleY = video.videoHeight / Math.max(processSize.height, 1);

          const boxes = detections.slice(0, 3).map((detection, index) => {
            const bbox = detection.boundingBox!;
            const sourceX = bbox.originX * sourceScaleX;
            const sourceY = bbox.originY * sourceScaleY;
            const sourceWidth = bbox.width * sourceScaleX;
            const sourceHeight = bbox.height * sourceScaleY;

            const projectedX = offsetX + (sourceX * coverScale);
            const projectedY = offsetY + (sourceY * coverScale);
            const projectedWidth = sourceWidth * coverScale;
            const projectedHeight = sourceHeight * coverScale;
            const mirroredX = displayWidth - (projectedX + projectedWidth);
            const confidence = getDetectionConfidence(detection);

            return {
              x: mirroredX,
              y: projectedY,
              width: projectedWidth,
              height: projectedHeight,
              tone: detections.length > 1 ? 'red' as const : 'yellow' as const,
              label: `Face ${index + 1} ${Math.round(confidence * 100)}%`
            };
          });

          const primaryDetection = detections[0];
          let nextState = DEFAULT_FACE_OVERLAY_STATE;

          if (!primaryDetection?.boundingBox) {
            renderStateRef.current = DEFAULT_RENDER_STATE;
            smoothedBoxRef.current = null;
            nextState = buildDetectionState({
              faceCount: detections.length,
              areaRatio: 0,
              centerOffsetX: 1,
              centerOffsetY: 1,
              brightness: 0,
              confidence: 0
            });
          } else {
            const bbox = primaryDetection.boundingBox;
            const confidence = getDetectionConfidence(primaryDetection);
            const areaRatio = (bbox.width * bbox.height) / Math.max(processSize.width * processSize.height, 1);
            const centerX = (bbox.originX + (bbox.width / 2)) / Math.max(processSize.width, 1);
            const centerY = (bbox.originY + (bbox.height / 2)) / Math.max(processSize.height, 1);
            const brightness = getFaceBrightness(
              processContext,
              bbox.originX,
              bbox.originY,
              bbox.width,
              bbox.height,
              processSize.width,
              processSize.height
            );

            nextState = buildDetectionState({
              faceCount: detections.length,
              areaRatio,
              centerOffsetX: Math.abs(centerX - 0.5),
              centerOffsetY: Math.abs(centerY - 0.5),
              brightness,
              confidence
            });

            if (detections.length === 1 && boxes[0]) {
              const primaryBox = {
                ...boxes[0],
                tone: nextState.tone,
                label: `${nextState.status === 'locked' ? 'Locked' : 'Tracking'} ${Math.round(confidence * 100)}%`
              };

              const smoothedBox = lerpBox(smoothedBoxRef.current, primaryBox);
              smoothedBoxRef.current = smoothedBox;
              renderStateRef.current = {
                boxes: [smoothedBox]
              };
            } else {
              smoothedBoxRef.current = null;
              renderStateRef.current = {
                boxes
              };
            }
          }

          const stateKey = publishStateKey(nextState);
          if (stateKey !== latestStateKeyRef.current) {
            latestStateKeyRef.current = stateKey;
            onStateChange?.(nextState);
          }
        }

        lastProcessedAtRef.current = time;
        lastVideoTimeRef.current = video.currentTime;
      }

      for (const box of renderStateRef.current.boxes) {
        const palette = getTonePalette(box.tone);
        const lockedPulse = box.tone === 'green' ? (0.5 + (0.5 * Math.sin(time / 180))) : 0;
        const lineWidth = box.tone === 'green' ? 3 + (lockedPulse * 1.5) : 2.5;
        const shadowBlur = box.tone === 'green' ? 16 + (lockedPulse * 8) : 10;
        const labelPaddingX = 12;
        const labelHeight = 26;
        const labelWidth = Math.max(118, (box.label.length * 7.2) + (labelPaddingX * 2));
        const labelX = clamp(box.x, 12, Math.max(displayWidth - labelWidth - 12, 12));
        const labelY = Math.max(box.y - labelHeight - 10, 12);

        context.save();
        context.lineWidth = lineWidth;
        context.strokeStyle = palette.stroke;
        context.fillStyle = palette.fill;
        context.shadowColor = palette.glow;
        context.shadowBlur = shadowBlur;

        drawRoundedRect(context, box.x, box.y, box.width, box.height, 18);
        context.fill();
        context.stroke();

        context.shadowBlur = 0;
        context.fillStyle = 'rgba(255, 255, 255, 0.92)';
        drawRoundedRect(context, labelX, labelY, labelWidth, labelHeight, 13);
        context.fill();
        context.strokeStyle = palette.stroke;
        context.lineWidth = 1.5;
        context.stroke();

        context.fillStyle = palette.label;
        context.font = '600 13px Aptos, "Segoe UI Variable", sans-serif';
        context.textBaseline = 'middle';
        context.fillText(box.label, labelX + labelPaddingX, labelY + (labelHeight / 2));
        context.restore();
      }

      animationFrameRef.current = window.requestAnimationFrame(drawFrame);
    };

    animationFrameRef.current = window.requestAnimationFrame(drawFrame);

    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [active, onStateChange, webcamRef]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-10 h-full w-full"
    />
  );
}
