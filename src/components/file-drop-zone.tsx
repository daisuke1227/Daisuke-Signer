
import { useState } from "react"
import { cn } from "@/lib/utils"
import { Upload } from "lucide-react"

export function FileDropZone() {
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
    // Handle files here
    console.log(files)
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "w-full max-w-2xl p-12 rounded-lg border-2 border-dashed transition-all duration-300 glass hover-glass",
        isDragging && "border-primary scale-[1.02]"
      )}
    >
      <div className="flex flex-col items-center justify-center gap-4 text-center">
        <div className="p-4 rounded-full bg-primary/10">
          <Upload className="w-8 h-8 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Drag and drop your IPA file</h3>
          <p className="text-sm text-muted-foreground">
            or click to select a file from your computer
          </p>
        </div>
      </div>
    </div>
  )
}
