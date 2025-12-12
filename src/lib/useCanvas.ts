import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "../constants/reservationConst";

// Use a local, slower zoom step for smoother control
const SLOW_ZOOM_STEP = 0.05; 

type Point = { x: number; y: number };
type Size = { width: number; height: number };
type PanUpdater = Point | ((current: Point) => Point);

export type UseCanvasResult = {
  canvasRef: RefObject<HTMLDivElement | null>;
  interactionLayerRef: RefObject<HTMLDivElement | null>;
  canvasSize: Size | null;
  zoom: number;
  pan: Point;
  isPanning: boolean;
  setPanState: (updater: PanUpdater) => void;
  applyZoom: (nextZoom: number, focusPoint?: Point) => void;
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleZoomReset: () => void;
  handleCanvasPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  handleCanvasPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  handleCanvasPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  handleCanvasPointerLeave: (event: ReactPointerEvent<HTMLDivElement>) => void;
  screenToWorld: (point: Point) => Point;
};

export function useCanvas(): UseCanvasResult {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const interactionLayerRef = useRef<HTMLDivElement | null>(null);
  const [mousePos, setMousePos] = useState<Point>({ x: 0, y: 0 });
  const [canvasSize, setCanvasSize] = useState<Size | null>(null);
  const touchMidRef = useRef<Point>({x: 0, y: 0});
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(zoom);
  
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const panRef = useRef(pan);
  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  const [isPanning, setIsPanning] = useState(false);

  // Track pointer state for touch gestures
  const pointerStateRef = useRef({
    isPanning: false,
    startPan: { x: 0, y: 0 },
    startPointer: { x: 0, y: 0 },
    touches: new Map<number, { x: number; y: number }>(),
    lastMidpointY: 0,
  });

  const hasInitializedRef = useRef(false);
  const lastSizeRef = useRef({ width: 0, height: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateSize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === lastSizeRef.current.width && rect.height === lastSizeRef.current.height) {
        return;
      }
      lastSizeRef.current = { width: rect.width, height: rect.height };
      setCanvasSize({ width: rect.width, height: rect.height });

      if (!hasInitializedRef.current && rect.width > 0 && rect.height > 0) {
        hasInitializedRef.current = true;
        let centerX = rect.width / 2 - WORLD_WIDTH / 2;
        let centerY = rect.height / 2 - WORLD_HEIGHT / 2;
        if (centerX < 0) centerX = 0;
        if (centerY < 0) centerY = 0;
        setPan({ x: centerX, y: centerY });
      }
    };

    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(canvas);

    return () => resizeObserver.disconnect();
  }, []);

  const screenToWorld = useCallback(
    (screen: Point): Point => {
      return {
        x: (screen.x - pan.x) / zoom,
        y: (screen.y - pan.y) / zoom,
      };
    },
    [pan, zoom]
  );

  const applyZoomWithOrigin = useCallback(
    (newZoom: number, origin: Point) => {
      const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
      const currentZoom = zoomRef.current;
      const currentPan = panRef.current;

      if (currentZoom === clampedZoom) return;

      const newPan = {
        x: origin.x - (origin.x - currentPan.x) * (clampedZoom / currentZoom),
        y: origin.y - (origin.y - currentPan.y) * (clampedZoom / currentZoom),
      };
      
      setPan(newPan);
      setZoom(clampedZoom);
    },
    []
  );

  const handleWheel = useCallback(
    (event: WheelEvent) => {
      event.preventDefault();

      const canvas = interactionLayerRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      const delta = event.deltaY < 0 ? 1 : -1;
      // SLOWER ZOOM: using SLOW_ZOOM_STEP (0.05) instead of standard
      const zoomFactor = delta > 0 ? 1 + SLOW_ZOOM_STEP : 1 - SLOW_ZOOM_STEP;
      const newZoom = zoomRef.current * zoomFactor;

      applyZoomWithOrigin(newZoom, { x: mouseX, y: mouseY });
    },
    [applyZoomWithOrigin, mousePos]
  );

  useEffect(() => {
    const interactionLayer = interactionLayerRef.current;
    if (!interactionLayer) return;

    interactionLayer.addEventListener("wheel", handleWheel, { passive: false });
    return () => interactionLayer.removeEventListener("wheel", handleWheel);
  }, [handleWheel, interactionLayerRef.current]);

  const getTouchMidpoint = (touches: Map<number, Point>): Point => {
    const points = Array.from(touches.values());
    if (points.length < 2) return { x: 0, y: 0 };
    return {
      x: (points[0].x + points[1].x) / 2,
      y: (points[0].y + points[1].y) / 2,
    };
  };

  const handleCanvasPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      if (target.closest("[data-table-node='true']")) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      pointerStateRef.current.touches.set(event.pointerId, { x, y });

      if (pointerStateRef.current.touches.size === 2) {
        const midpoint = getTouchMidpoint(pointerStateRef.current.touches);
        pointerStateRef.current.lastMidpointY = midpoint.y;
        pointerStateRef.current.isPanning = false;
        setIsPanning(false);
        return;
      }

      if (pointerStateRef.current.touches.size === 1) {
        pointerStateRef.current.isPanning = true;
        pointerStateRef.current.startPan = { ...pan };
        pointerStateRef.current.startPointer = { x, y };
        setIsPanning(true);
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    },
    [pan]
  );

  const handleTwoFingerZoom = useCallback((touches: Map<number, Point>) => {
    if (touches.size !== 2) return;

    const pts = Array.from(touches.values());
    const midpoint = {
      x: (pts[0].x + pts[1].x) / 2,
      y: (pts[0].y + pts[1].y) / 2,
    };

    const lastY = pointerStateRef.current.lastMidpointY;

    if (lastY !== 0) {
      const deltaY = midpoint.y - lastY;
      const zoomChange = -deltaY * 0.01; // Also slowed down touch zoom
      const newZoom = zoomRef.current * (1 + zoomChange);
      applyZoomWithOrigin(newZoom, midpoint);
    }

    pointerStateRef.current.lastMidpointY = midpoint.y;
    touchMidRef.current = midpoint;
  }, [applyZoomWithOrigin]);


  const handleCanvasPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      setMousePos({x, y});
      if (pointerStateRef.current.touches.has(event.pointerId)) {
        pointerStateRef.current.touches.set(event.pointerId, { x, y });
      }

      if (pointerStateRef.current.touches.size === 2) {
        handleTwoFingerZoom(pointerStateRef.current.touches);
        return;
      }

      if (pointerStateRef.current.isPanning) {
        const dx = x - pointerStateRef.current.startPointer.x;
        const dy = y - pointerStateRef.current.startPointer.y;

        setPan({
          x: pointerStateRef.current.startPan.x + dx,
          y: pointerStateRef.current.startPan.y + dy,
        });
      }
    },
    [applyZoomWithOrigin]
  );

  const handleCanvasPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      pointerStateRef.current.touches.delete(event.pointerId);

      if (pointerStateRef.current.touches.size === 0) {
        pointerStateRef.current.isPanning = false;
        pointerStateRef.current.lastMidpointY = 0;
        setIsPanning(false);
      }

      event.currentTarget.releasePointerCapture(event.pointerId);
    },
    [handleTwoFingerZoom, touchMidRef]
  );

  const handleCanvasPointerLeave = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      handleCanvasPointerUp(event);
    },
    [handleCanvasPointerUp]
  );

  // Button zoom handlers - Slower
  const handleZoomIn = useCallback(() => {
    if (!canvasSize) return;
    const center = { x: canvasSize.width / 2, y: canvasSize.height / 2 };
    applyZoomWithOrigin(zoom + SLOW_ZOOM_STEP, center);
  }, [zoom, canvasSize, applyZoomWithOrigin]);

  const handleZoomOut = useCallback(() => {
    if (!canvasSize) return;
    const center = { x: canvasSize.width / 2, y: canvasSize.height / 2 };
    applyZoomWithOrigin(zoom - SLOW_ZOOM_STEP, center);
  }, [zoom, canvasSize, applyZoomWithOrigin]);

  const handleZoomReset = useCallback(() => {
    if (!canvasSize) return;
    setZoom(1);
    let centerX = canvasSize.width / 2 - WORLD_WIDTH / 2;
    let centerY = canvasSize.height / 2 - WORLD_HEIGHT / 2;
    if (centerX < 0) centerX = 0;
    if (centerY < 0) centerY = 0;
    setPan({ x: centerX, y: centerY });
  }, [canvasSize]);

  const setPanState = useCallback((updater: PanUpdater) => {
    setPan(updater);
  }, []);

  const applyZoom = useCallback(
    (nextZoom: number, focusPoint?: Point) => {
      if (!canvasSize && !focusPoint) {
        setZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoom)));
        return;
      }
      const focus = focusPoint ?? {
        x: canvasSize!.width / 2,
        y: canvasSize!.height / 2,
      };
      applyZoomWithOrigin(nextZoom, focus);
    },
    [canvasSize, applyZoomWithOrigin]
  );

  return {
    canvasRef,
    interactionLayerRef,
    canvasSize,
    zoom,
    pan,
    isPanning,
    setPanState,
    applyZoom,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
    handleCanvasPointerDown,
    handleCanvasPointerMove,
    handleCanvasPointerUp,
    handleCanvasPointerLeave,
    screenToWorld,
  };
}
