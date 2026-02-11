import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { RotateCw, RotateCcw, Save, Eraser, Undo2, ZoomIn, ZoomOut } from 'lucide-react';
import { toast } from 'sonner';

interface PhotoEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string;
  fileName: string;
  onSave: (editedFile: File) => void;
}

const PhotoEditorModal: React.FC<PhotoEditorModalProps> = ({
  open,
  onOpenChange,
  imageUrl,
  fileName,
  onSave,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rotation, setRotation] = useState(0);
  const [scale, setScale] = useState(100);
  const [bgRemoveMode, setBgRemoveMode] = useState(false);
  const [tolerance, setTolerance] = useState(30);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null);

  // Load image when modal opens
  useEffect(() => {
    if (!open || !imageUrl) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setOriginalImage(img);
      setRotation(0);
      setScale(100);
      setHistory([]);
    };
    img.src = imageUrl;
  }, [open, imageUrl]);

  // Render canvas
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = originalImage;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const isVertical = rotation === 90 || rotation === 270;
    const scaleFactor = scale / 100;
    const w = img.width * scaleFactor;
    const h = img.height * scaleFactor;

    canvas.width = isVertical ? h : w;
    canvas.height = isVertical ? w : h;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();

    // Save initial state to history
    if (history.length === 0) {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setHistory([imageData]);
    }
  }, [originalImage, rotation, scale, history.length]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  const handleRotate = (dir: 'cw' | 'ccw') => {
    setHistory([]);
    setRotation(prev => {
      const newRot = dir === 'cw' ? (prev + 90) % 360 : (prev - 90 + 360) % 360;
      return newRot;
    });
  };

  const handleScaleChange = (value: number[]) => {
    setHistory([]);
    setScale(value[0]);
  };

  // Flood fill background removal
  const floodFill = useCallback((startX: number, startY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;

    // Save state for undo
    const prevData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory(prev => [...prev, prevData]);

    const startIdx = (startY * width + startX) * 4;
    const targetR = data[startIdx];
    const targetG = data[startIdx + 1];
    const targetB = data[startIdx + 2];

    if (data[startIdx + 3] === 0) return; // Already transparent

    const tol = tolerance;
    const visited = new Uint8Array(width * height);
    const stack: number[] = [startX, startY];

    const matches = (idx: number) => {
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      return (
        Math.abs(r - targetR) <= tol &&
        Math.abs(g - targetG) <= tol &&
        Math.abs(b - targetB) <= tol &&
        data[idx + 3] > 0
      );
    };

    while (stack.length > 0) {
      const y = stack.pop()!;
      const x = stack.pop()!;
      const pos = y * width + x;

      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      if (visited[pos]) continue;

      const idx = pos * 4;
      if (!matches(idx)) continue;

      visited[pos] = 1;
      data[idx + 3] = 0; // Make transparent

      stack.push(x + 1, y);
      stack.push(x - 1, y);
      stack.push(x, y + 1);
      stack.push(x, y - 1);
    }

    ctx.putImageData(imageData, 0, 0);
  }, [tolerance]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!bgRemoveMode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);

    floodFill(x, y);
  }, [bgRemoveMode, floodFill]);

  const handleUndo = () => {
    const canvas = canvasRef.current;
    if (!canvas || history.length <= 1) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const newHistory = [...history];
    newHistory.pop();
    const lastState = newHistory[newHistory.length - 1];
    
    canvas.width = lastState.width;
    canvas.height = lastState.height;
    ctx.putImageData(lastState, 0, 0);
    setHistory(newHistory);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (!blob) {
        toast.error('Erro ao salvar imagem');
        return;
      }
      const safeName = fileName.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const file = new File([blob], `${safeName}.png`, { type: 'image/png' });
      onSave(file);
      onOpenChange(false);
      toast.success('Foto editada salva com sucesso!');
    }, 'image/png');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">Editor de Foto</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Canvas area */}
          <div
            className="relative bg-[repeating-conic-gradient(#d1d5db_0%_25%,transparent_0%_50%)_50%/16px_16px] border rounded-lg overflow-hidden flex items-center justify-center"
            style={{ minHeight: 200, maxHeight: 350 }}
          >
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              className={`max-w-full max-h-[340px] object-contain ${bgRemoveMode ? 'cursor-crosshair' : 'cursor-default'}`}
            />
          </div>

          {/* Controls */}
          <div className="space-y-3">
            {/* Rotation */}
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Rotação</Label>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handleRotate('ccw')} className="h-8 w-8 p-0">
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleRotate('cw')} className="h-8 w-8 p-0">
                  <RotateCw className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Scale */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium flex items-center gap-1">
                  <ZoomIn className="h-3 w-3" /> Tamanho: {scale}%
                </Label>
              </div>
              <Slider
                min={30}
                max={200}
                step={5}
                value={[scale]}
                onValueChange={handleScaleChange}
              />
            </div>

            {/* Background removal */}
            <div className="space-y-2 border-t pt-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium flex items-center gap-1">
                  <Eraser className="h-3 w-3" /> Remover Fundo
                </Label>
                <Button
                  variant={bgRemoveMode ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setBgRemoveMode(!bgRemoveMode)}
                >
                  {bgRemoveMode ? 'Ativo ✓' : 'Ativar'}
                </Button>
              </div>
              {bgRemoveMode && (
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">
                    Clique na área do fundo para remover. Tolerância: {tolerance}
                  </Label>
                  <Slider
                    min={5}
                    max={80}
                    step={5}
                    value={[tolerance]}
                    onValueChange={(v) => setTolerance(v[0])}
                  />
                </div>
              )}
            </div>

            {/* Undo */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={handleUndo}
                disabled={history.length <= 1}
              >
                <Undo2 className="h-3 w-3 mr-1" /> Desfazer
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSave} className="bg-brand-purple hover:bg-brand-darkPurple">
            <Save className="h-3.5 w-3.5 mr-1.5" />
            Salvar e Usar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PhotoEditorModal;
