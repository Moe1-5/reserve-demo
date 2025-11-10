import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  ZOOM_STEP,
} from "../constants/reservationConst";

type Point = { x: number; y: number };
type Size = { width: number; height: number };
type PanUpdater =
  | Point
  | ((current: Point) => Point);

type PinchState = {
  distance: number;
  midpoint: Point;
  zoom: number;
  pan: Point;
};

function clampPanToWorld(pan: Point, viewport: Size | null, zoom: number): Point {
  if (!viewport) {
    return pan;
  }

  const worldWidth = WORLD_WIDTH * zoom;
  const worldHeight = WORLD_HEIGHT * zoom;

  const horizontalCenter = (viewport.width - worldWidth) / 2;
  const verticalCenter = (viewport.height - worldHeight) / 2;

  const clampedX =
    worldWidth <= viewport.width
      ? horizontalCenter
      : Math.min(0, Math.max(pan.x, viewport.width - worldWidth));

  const clampedY =
    worldHeight <= viewport.height
      ? verticalCenter
      : Math.min(0, Math.max(pan.y, viewport.height - worldHeight));

  return { x: clampedX, y: clampedY };
}

export type UseCanvasResult = {
  canvasRef: MutableRefObject<HTMLDivElement | null>;
  interactionLayerRef: MutableRefObject<HTMLDivElement | null>;
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

  const [canvasSize, setCanvasSize] = useState<Size | null>(null);
  const canvasSizeRef = useRef<Size | null>(canvasSize);

  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);

  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const panRef = useRef<Point>(pan);

  const [isPanning, setIsPanning] = useState(false);
  const isPanningRef = useRef(false);

  const pointerTypeRef = useRef<string | null>(null);
  const lastPanPointRef = useRef<Point | null>(null);
  const activePointersRef = useRef(new Map<number, Point>());
  const pinchStateRef = useRef<PinchState | null>(null);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  useEffect(() => {
    canvasSizeRef.current = canvasSize;
  }, [canvasSize]);

  const setPanState = useCallback(
    (updater: PanUpdater) => {
      setPan((prev) => {
        const nextValue =
          typeof updater === "function" ? (updater as (current: Point) => Point)(prev) : updater;
        const clamped = clampPanToWorld(nextValue, canvasSizeRef.current, zoomRef.current);
        if (clamped.x === prev.x && clamped.y === prev.y) {
          panRef.current = prev;
          return prev;
        }
        panRef.current = clamped;
        return clamped;
      });
    },
    [],
  );

  const clampZoom = useCallback(
    (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value)),
    [],
  );

  const applyZoom = useCallback(
    (nextZoom: number, focusPoint?: Point) => {
      const size = canvasSizeRef.current;
      const currentZoom = zoomRef.current;
      const clampedZoom = clampZoom(Math.round(nextZoom * 100) / 100);

      if (!size) {
        zoomRef.current = clampedZoom;
        setZoom((prev) => (prev === clampedZoom ? prev : clampedZoom));
        setPanState({ x: 0, y: 0 });
        return;
      }

      const focus =
        focusPoint ?? {
          x: size.width / 2,
          y: size.height / 2,
        };

      const currentPan = panRef.current;
      const canvasPoint = {
        x: focus.x / currentZoom - currentPan.x,
        y: focus.y / currentZoom - currentPan.y,
      };

      const panRaw = {
        x: focus.x / clampedZoom - canvasPoint.x,
        y: focus.y / clampedZoom - canvasPoint.y,
      };

      zoomRef.current = clampedZoom;
      setZoom((prev) => (prev === clampedZoom ? prev : clampedZoom));
      setPanState(() => panRaw);
    },
    [clampZoom, setPanState],
  );

  const handleZoomIn = useCallback(() => {
    applyZoom(zoomRef.current + ZOOM_STEP);
  }, [applyZoom]);

  const handleZoomOut = useCallback(() => {
    applyZoom(zoomRef.current - ZOOM_STEP);
  }, [applyZoom]);

  const handleZoomReset = useCallback(() => {
    applyZoom(1);
    setPanState({ x: 0, y: 0 });
  }, [applyZoom, setPanState]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const updateSize = () => {
      const rect = canvas.getBoundingClientRect();
      setCanvasSize({ width: rect.width, height: rect.height });
    };

    updateSize();

    let resizeObserver: ResizeObserver | null = null;

    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        updateSize();
      });
      resizeObserver.observe(canvas);
    } else {
      window.addEventListener("resize", updateSize);
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener("resize", updateSize);
      }
    };
  }, []);

  const getCanvasPoint = useCallback((clientX: number, clientY: number): Point => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return { x: clientX, y: clientY };
    }
    const rect = canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }, []);

  const handleCanvasWheel = useCallback(
    (event: WheelEvent) => {
      event.preventDefault();

      const ctrlLike = event.ctrlKey || event.metaKey;

      if (ctrlLike) {
        const focus = getCanvasPoint(event.clientX, event.clientY);
        const delta = -event.deltaY * 0.002;
        if (delta !== 0) {
          applyZoom(zoomRef.current * (1 + delta), focus);
        }
        return;
      }

      const { deltaX, deltaY } = event;
      if (deltaX === 0 && deltaY === 0) {
        return;
      }

      setPanState((prev) => ({
        x: prev.x - deltaX,
        y: prev.y - deltaY,
      }));
    },
    [applyZoom, getCanvasPoint, setPanState],
  );

  useEffect(() => {
    const node = interactionLayerRef.current;
    if (!node) return;

    const listener = (event: WheelEvent) => {
      handleCanvasWheel(event);
    };

    node.addEventListener("wheel", listener, { passive: false });

    return () => {
      node.removeEventListener("wheel", listener);
    };
  }, [handleCanvasWheel]);

  const handleCanvasPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      if (target.closest("[data-table-node='true']")) {
        return;
      }

      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }

      const currentTarget = event.currentTarget;
      const point = getCanvasPoint(event.clientX, event.clientY);

      if (event.pointerType === "touch") {
        activePointersRef.current.set(event.pointerId, point);

        if (activePointersRef.current.size === 2) {
          const [p1, p2] = Array.from(activePointersRef.current.values());
          pinchStateRef.current = {
            distance: Math.hypot(p1.x - p2.x, p1.y - p2.y),
            midpoint: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 },
            zoom: zoomRef.current,
            pan: panRef.current,
          };
          isPanningRef.current = false;
          setIsPanning(false);
        } else {
          pinchStateRef.current = null;
          isPanningRef.current = true;
          pointerTypeRef.current = event.pointerType;
          lastPanPointRef.current = { x: event.clientX, y: event.clientY };
          setIsPanning(true);
        }

        currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault();
        return;
      }

      isPanningRef.current = true;
      pointerTypeRef.current = event.pointerType;
      lastPanPointRef.current = { x: event.clientX, y: event.clientY };
      setIsPanning(true);
      currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
    },
    [getCanvasPoint],
  );

  const handleCanvasPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const point = getCanvasPoint(event.clientX, event.clientY);

      if (event.pointerType === "touch") {
        activePointersRef.current.set(event.pointerId, point);

        if (activePointersRef.current.size === 2) {
          const [p1, p2] = Array.from(activePointersRef.current.values());
          const distance = Math.hypot(p1.x - p2.x, p1.y - p2.y);
          const midpoint = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

          const pinchState = pinchStateRef.current;
          if (!pinchState) {
            pinchStateRef.current = {
              distance,
              midpoint,
              zoom: zoomRef.current,
              pan: panRef.current,
            };
            isPanningRef.current = false;
            setIsPanning(false);
            return;
          }

          if (pinchState.distance > 0) {
            const ratio = distance / pinchState.distance;
            const targetZoom = clampZoom(pinchState.zoom * ratio);
            applyZoom(targetZoom, midpoint);
            pinchStateRef.current = {
              distance,
              midpoint,
              zoom: zoomRef.current,
              pan: panRef.current,
            };
          }
          event.preventDefault();
          return;
        }

        if (activePointersRef.current.size === 1) {
          if (!isPanningRef.current) {
            isPanningRef.current = true;
            pointerTypeRef.current = event.pointerType;
            setIsPanning(true);
          }
          lastPanPointRef.current = { x: event.clientX, y: event.clientY };
        }
      }

      if (isPanningRef.current && pointerTypeRef.current === event.pointerType) {
        const lastPoint = lastPanPointRef.current;
        if (!lastPoint) {
          lastPanPointRef.current = { x: event.clientX, y: event.clientY };
          return;
        }

        const deltaX = event.clientX - lastPoint.x;
        const deltaY = event.clientY - lastPoint.y;

        if (deltaX === 0 && deltaY === 0) {
          return;
        }

        lastPanPointRef.current = { x: event.clientX, y: event.clientY };

        setPanState((prev) => ({
          x: prev.x + deltaX,
          y: prev.y + deltaY,
        }));

        event.preventDefault();
      }
    },
    [applyZoom, clampZoom, getCanvasPoint, setPanState],
  );

  const endPanIfNeeded = useCallback(() => {
    isPanningRef.current = false;
    pointerTypeRef.current = null;
    lastPanPointRef.current = null;
    if (isPanning) {
      setIsPanning(false);
    }
  }, [isPanning]);

  const handleCanvasPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerType === "touch") {
        activePointersRef.current.delete(event.pointerId);
        if (activePointersRef.current.size < 2) {
          pinchStateRef.current = null;
        }
      }

      if (pointerTypeRef.current === event.pointerType) {
        endPanIfNeeded();
      }

      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // ignore
      }
    },
    [endPanIfNeeded],
  );

  const handleCanvasPointerLeave = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (pointerTypeRef.current === event.pointerType) {
        endPanIfNeeded();
      }
    },
    [endPanIfNeeded],
  );

  const screenToWorld = useCallback((point: Point) => {
    const currentPan = panRef.current;
    const currentZoom = zoomRef.current;
    return {
      x: (point.x - currentPan.x) / currentZoom,
      y: (point.y - currentPan.y) / currentZoom,
    };
  }, []);

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
