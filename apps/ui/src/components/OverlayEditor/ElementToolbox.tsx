import {
  AnnotationIcon,
  CursorClickIcon,
  LightningBoltIcon,
  PhotographIcon,
  TemplateIcon,
  VariableIcon,
} from '@heroicons/react/outline'
import type {
  OverlayElement,
  OverlayTemplateMode,
} from '@maintainerr/contracts'

interface ElementToolboxProps {
  mode: OverlayTemplateMode
  onAdd: (el: OverlayElement) => void
  nextLayerOrder: number
}

let _uid = 0
const uid = () => `el-${Date.now()}-${++_uid}`

export function ElementToolbox({ onAdd, nextLayerOrder }: ElementToolboxProps) {
  const addText = () => {
    onAdd({
      id: uid(),
      type: 'text',
      x: 50,
      y: 50,
      width: 300,
      height: 60,
      rotation: 0,
      layerOrder: nextLayerOrder,
      opacity: 1,
      visible: true,
      text: 'New Text',
      fontFamily: 'Inter',
      fontPath: 'Inter-Bold.ttf',
      fontSize: 36,
      fontColor: '#FFFFFF',
      fontWeight: 'bold',
      textAlign: 'left',
      verticalAlign: 'middle',
      backgroundColor: null,
      backgroundRadius: 0,
      backgroundPadding: 0,
      shadow: false,
      uppercase: false,
    })
  }

  const addVariable = (isKometa = false) => {
    onAdd({
      id: uid(),
      type: 'variable',
      x: isKometa ? 20 : 50,
      y: isKometa ? 20 : 50,
      width: isKometa ? 380 : 350,
      height: isKometa ? 80 : 60,
      rotation: 0,
      layerOrder: nextLayerOrder,
      opacity: 1,
      visible: true,
      segments: isKometa
        ? [
            { type: 'text', value: 'Leaving ' },
            { type: 'variable', field: 'daysText' },
          ]
        : [
            { type: 'text', value: 'Leaving ' },
            { type: 'variable', field: 'date' },
          ],
      fontFamily: 'Inter',
      fontPath: 'Inter-Bold.ttf',
      fontSize: isKometa ? 40 : 36,
      fontColor: '#FFFFFF',
      fontWeight: 'bold',
      textAlign: 'center',
      verticalAlign: 'middle',
      backgroundColor: null,
      backgroundRadius: 0,
      backgroundPadding: 0,
      shadow: false,
      uppercase: false,
      dateFormat: 'MMM d',
      language: 'en-US',
      enableDaySuffix: false,
      textToday: 'today',
      textDay: '1 day',
      textDays: '{0} days',
      ...(isKometa && {
        kometa: {
          urgentDays: 3,
          urgentColor: '#ffffff',
          warningColor: '#000000',
        },
      }),
    })
  }

  const addShape = (shape: 'rectangle' | 'ellipse', isKometa = false) => {
    onAdd({
      id: uid(),
      type: 'shape',
      x: isKometa ? 20 : 50,
      y: isKometa ? 20 : 50,
      width: isKometa ? 380 : 200,
      height: shape === 'ellipse' ? 200 : isKometa ? 80 : 60,
      rotation: 0,
      layerOrder: nextLayerOrder,
      opacity: 1,
      visible: true,
      shapeType: shape,
      fillColor: isKometa ? '#E31E24' : '#B20710',
      strokeColor: null,
      strokeWidth: 0,
      cornerRadius: shape === 'rectangle' ? (isKometa ? 20 : 12) : 0,
      ...(isKometa && {
        kometa: {
          urgentDays: 3,
          urgentColor: '#E31E24',
          warningColor: '#F1C40F',
        },
      }),
    })
  }

  const addImage = () => {
    onAdd({
      id: uid(),
      type: 'image',
      x: 50,
      y: 50,
      width: 200,
      height: 200,
      rotation: 0,
      layerOrder: nextLayerOrder,
      opacity: 1,
      visible: true,
      imagePath: '',
    })
  }

  return (
    <div className="space-y-6">
      {/* Native Elements */}
      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-400">
          Elements
        </h3>
        <div className="flex flex-col gap-1.5">
          <ToolButton icon={AnnotationIcon} label="Text" onClick={addText} />
          <ToolButton
            icon={VariableIcon}
            label="Variable"
            onClick={() => addVariable()}
          />
          <ToolButton
            icon={TemplateIcon}
            label="Rectangle"
            onClick={() => addShape('rectangle')}
          />
          <ToolButton
            icon={CursorClickIcon}
            label="Ellipse"
            onClick={() => addShape('ellipse')}
          />
          <ToolButton icon={PhotographIcon} label="Image" onClick={addImage} />
        </div>
      </div>

      {/* Kometa Smart Elements */}
      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-amber-500">
          Kometa Smart
        </h3>
        <div className="flex flex-col gap-1.5">
          <ToolButton
            icon={LightningBoltIcon}
            label="Smart Background"
            onClick={() => addShape('rectangle', true)}
            className="text-amber-200 hover:bg-amber-900/30"
            iconClassName="text-amber-500"
          />
          <ToolButton
            icon={LightningBoltIcon}
            label="Smart Countdown"
            onClick={() => addVariable(true)}
            className="text-amber-200 hover:bg-amber-900/30"
            iconClassName="text-amber-500"
          />
        </div>
      </div>
    </div>
  )
}

function ToolButton({
  icon: Icon,
  label,
  onClick,
  className = 'text-zinc-300 hover:bg-zinc-700',
  iconClassName = 'text-zinc-400',
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  label: string
  onClick: () => void
  className?: string
  iconClassName?: string
}) {
  return (
    <button
      type="button"
      className={`flex items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition ${className}`}
      onClick={onClick}
    >
      <Icon className={`h-4 w-4 shrink-0 ${iconClassName}`} />
      {label}
    </button>
  )
}
