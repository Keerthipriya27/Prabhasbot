import { useCallback, useState } from "react";
import { Upload, Image as ImageIcon } from "lucide-react";

interface ImageDropzoneProps {
  onImageSelect: (base64: string) => void;
  disabled?: boolean;
}

export function ImageDropzone({ onImageSelect, disabled }: ImageDropzoneProps) {
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") onImageSelect(reader.result);
      };
      reader.readAsDataURL(file);
    },
    [onImageSelect]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      className={`
        relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed 
        p-12 cursor-pointer transition-all duration-300
        ${dragOver ? "border-primary bg-primary/5 shadow-[0_0_40px_-10px_hsl(var(--glow)/0.3)]" : "border-border hover:border-muted-foreground"}
        ${disabled ? "opacity-50 pointer-events-none" : ""}
      `}
    >
      <div className="rounded-xl bg-secondary p-4">
        {dragOver ? (
          <ImageIcon className="h-8 w-8 text-primary" />
        ) : (
          <Upload className="h-8 w-8 text-muted-foreground" />
        )}
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">
          Drop an image here or <span className="text-primary underline underline-offset-4">browse</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">PNG, JPG, WEBP up to 10MB</p>
      </div>
      <input
        type="file"
        accept="image/*"
        className="absolute inset-0 opacity-0 cursor-pointer"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
        disabled={disabled}
      />
    </label>
  );
}
