import { Switch } from '@headlessui/react'
import { RefreshIcon } from '@heroicons/react/solid'
import type { OverlayElement } from '@maintainerr/contracts'
import { POSTER_CANVAS } from '@maintainerr/contracts'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import {
  buildItemImageUrl,
  getOverlayFonts,
  getOverlayImages,
  getOverlaySections,
  getRandomItem,
  uploadFont,
  uploadOverlayImage,
  useOverlaySettings,
  useUpdateOverlaySettings,
} from '../api/overlays'
import Button from '../components/Common/Button'
import LoadingSpinner from '../components/Common/LoadingSpinner'
import PageControlRow from '../components/Common/PageControlRow'
import SaveButton from '../components/Common/SaveButton'
import { Select } from '../components/Forms/Select'
import { ElementToolbox } from '../components/OverlayEditor/ElementToolbox'
import { LayerPanel } from '../components/OverlayEditor/LayerPanel'
import { OverlayCanvas } from '../components/OverlayEditor/OverlayCanvas'
import { PropertiesPanel } from '../components/OverlayEditor/PropertiesPanel'
import {
  invalidateOverlayEditorFont,
  loadOverlayEditorFonts,
} from '../components/OverlayEditor/editorFonts'
import { useUndoRedo } from '../hooks/useUndoRedo'
import { getApiErrorMessage } from '../utils/ApiError'

const OverlayKometaPage = () => {
  const { data: settings, isLoading: isSettingsLoading } = useOverlaySettings()
  const updateSettings = useUpdateOverlaySettings()

  // --- Kometa Globals ---
  const [enabled, setEnabled] = useState(false)
  const [urgentDays, setUrgentDays] = useState(3)
  const [warningDays, setWarningDays] = useState(10)
  const [saving, setSaving] = useState(false)

  // --- Editor State ---
  const [sections, setSections] = useState<
    { key: string; title: string; type: string }[]
  >([])
  const [selectedSection, setSelectedSection] = useState('')
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null)
  const [fonts, setFonts] = useState<{ name: string; path: string }[]>([])
  const [images, setImages] = useState<{ name: string; path: string }[]>([])
  const [fontLoadVersion, setFontLoadVersion] = useState(0)
  const [imageLoadVersion, setImageLoadVersion] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mobileTab, setMobileTab] = useState<
    'tools' | 'layers' | 'properties' | 'kometa'
  >('kometa')

  const canvasDefaults = POSTER_CANVAS

  const {
    current: elements,
    set: setElements,
    undo,
    redo,
    canUndo,
    canRedo,
    reset: resetElements,
  } = useUndoRedo<OverlayElement[]>([])

  const selectedElement = useMemo(
    () => elements.find((el) => el.id === selectedId) ?? null,
    [elements, selectedId],
  )

  // --- Init Settings ---
  useEffect(() => {
    if (settings) {
      setEnabled(settings.kometaEnabled ?? false)
      setUrgentDays(settings.kometaUrgentDays ?? 3)
      setWarningDays(settings.kometaWarningDays ?? 10)

      // TODO: spaeter laden wir hier settings.kometaElements
      // resetElements(settings.kometaElements ?? [])
    }
  }, [settings, resetElements])

  // --- Load Assets ---
  useEffect(() => {
    void getOverlaySections()
      .then((s) => {
        if (s) setSections(s)
      })
      .catch(() => toast.warning('Could not load library sections.'))
    void getOverlayFonts()
      .then((f) => {
        if (f) setFonts(f)
      })
      .catch(() => toast.warning('Could not load fonts.'))
    void getOverlayImages()
      .then((i) => {
        if (i) setImages(i)
      })
      .catch(() => toast.warning('Could not load images.'))
  }, [])

  useEffect(() => {
    if (fonts.length === 0) return
    let cancelled = false
    void loadOverlayEditorFonts(fonts)
      .catch(() => undefined)
      .then(() => {
        if (!cancelled) setFontLoadVersion((v) => v + 1)
      })
    return () => {
      cancelled = true
    }
  }, [fonts])

  // --- Editor Handlers ---
  const handleUploadFont = useCallback(async (file: File) => {
    try {
      const result = await uploadFont(file)
      if (result) {
        invalidateOverlayEditorFont(result.name)
        const updated = await getOverlayFonts()
        if (updated) setFonts(updated)
        toast.success(`Font "${result.name}" uploaded`)
        return result
      }
    } catch {
      toast.error('Failed to upload font')
    }
    return null
  }, [])

  const handleUploadImage = useCallback(async (file: File) => {
    let result = null
    try {
      result = await uploadOverlayImage(file)
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to upload image'))
      return null
    }
    if (!result) return null
    setImageLoadVersion((v) => v + 1)
    toast.success(`Image "${result.name}" uploaded`)
    try {
      const updated = await getOverlayImages()
      if (updated) setImages(updated)
    } catch {
      /* Swallowed */
    }
    return result
  }, [])

  const loadRandomPoster = useCallback(async () => {
    if (!selectedSection) return
    const item = await getRandomItem(selectedSection)
    if (item) setBackgroundUrl(buildItemImageUrl(item.itemId))
  }, [selectedSection])

  useEffect(() => {
    if (!selectedSection) return
    let cancelled = false
    void getRandomItem(selectedSection).then((item) => {
      if (cancelled || !item) return
      setBackgroundUrl(buildItemImageUrl(item.itemId))
    })
    return () => {
      cancelled = true
    }
  }, [selectedSection])

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        e.preventDefault()
        redo()
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId && document.activeElement === document.body) {
          e.preventDefault()
          setElements((prev) => prev.filter((el) => el.id !== selectedId))
          setSelectedId(null)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo, redo, selectedId, setElements])

  // --- Element Handlers ---
  const handleAddElement = useCallback(
    (el: OverlayElement) => {
      setElements((prev) => [...prev, el])
      setSelectedId(el.id)
    },
    [setElements],
  )
  const handleUpdateElement = useCallback(
    (updated: OverlayElement) => {
      setElements((prev) =>
        prev.map((el) => (el.id === updated.id ? updated : el)),
      )
    },
    [setElements],
  )
  const handleDeleteElement = useCallback(
    (elId: string) => {
      setElements((prev) => prev.filter((el) => el.id !== elId))
      if (selectedId === elId) setSelectedId(null)
    },
    [setElements, selectedId],
  )
  const handleReorder = useCallback(
    (reordered: OverlayElement[]) => {
      setElements(reordered)
    },
    [setElements],
  )

  // --- Save Handler ---
  const handleSave = async () => {
    setSaving(true)
    try {
      await updateSettings.mutateAsync({
        kometaEnabled: enabled,
        kometaUrgentDays: urgentDays,
        kometaWarningDays: warningDays,
        // TODO: spaeter senden wir hier kometaElements: elements
      })
      toast.success('Kometa Design saved successfully!')
    } catch (err) {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (isSettingsLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <>
      <div className="flex h-full w-full flex-col">
        <div className="section w-full shrink-0">
          <h3 className="heading">Kometa Export Design</h3>
          <p className="description">
            Design your dynamic Kometa banner directly on the canvas. Add a text
            element and use variables like {'{daysText}'} for dynamic
            countdowns.
          </p>
        </div>

        <PageControlRow
          actions={
            <>
              <Button
                className="h-10 px-3"
                type="button"
                onClick={undo}
                disabled={!canUndo}
              >
                Prev
              </Button>
              <SaveButton
                type="button"
                onClick={handleSave}
                disabled={saving}
                isPending={saving}
                label="Save Kometa Design"
                pendingLabel="Saving..."
              />
              <Button
                className="h-10 px-3"
                type="button"
                onClick={redo}
                disabled={!canRedo}
              >
                Next
              </Button>

              {/* Background Picker */}
              <div className="flex w-56 items-center gap-2">
                <Select
                  name="background-section"
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                >
                  <option value="">No preview background</option>
                  {sections.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.title}
                    </option>
                  ))}
                </Select>
                {selectedSection && (
                  <button
                    type="button"
                    className="shrink-0 rounded p-1 text-zinc-400 transition hover:text-zinc-200"
                    onClick={loadRandomPoster}
                    title="Load different poster"
                  >
                    <RefreshIcon className="h-4 w-4" />
                  </button>
                )}
              </div>
            </>
          }
          controlsClassName="sm:w-auto"
        />

        <div className="mt-4 flex h-[60vh] min-h-[30rem] flex-1 flex-col border-t border-zinc-700 lg:flex-row">
          {/* Left: Toolbox */}
          <div className="hidden w-48 shrink-0 overflow-y-auto border-r border-zinc-700 p-3 lg:block">
            <ElementToolbox
              mode="poster"
              onAdd={handleAddElement}
              nextLayerOrder={elements.length}
            />
          </div>

          {/* Center: Canvas */}
          <div className="flex min-h-[200px] flex-1 items-center justify-center overflow-auto bg-zinc-900/50 p-4">
            <OverlayCanvas
              elements={elements}
              canvasWidth={canvasDefaults.width}
              canvasHeight={canvasDefaults.height}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onUpdate={handleUpdateElement}
              backgroundUrl={backgroundUrl}
              fontLoadVersion={fontLoadVersion}
              imageLoadVersion={imageLoadVersion}
            />
          </div>

          {/* Right: Properties + Layers + Kometa Config */}
          <div className="hidden w-72 shrink-0 overflow-y-auto border-l border-zinc-700 bg-zinc-900/30 lg:block">
            {/* NEU: Kometa Globals Sidebar Panel */}
            <div className="border-b border-zinc-700 bg-zinc-950/50 p-4">
              <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-zinc-400">
                Kometa Config
              </h4>

              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-medium text-white">
                  Enable Export
                </span>
                <Switch
                  checked={enabled}
                  onChange={setEnabled}
                  className={`${enabled ? 'bg-amber-600' : 'bg-zinc-700'} relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none`}
                >
                  <span
                    className={`${enabled ? 'translate-x-4' : 'translate-x-0'} pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                  />
                </Switch>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">
                    Urgent (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-white focus:border-amber-500 focus:ring-amber-500"
                    value={urgentDays}
                    onChange={(e) => setUrgentDays(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">
                    Warning (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-white focus:border-amber-500 focus:ring-amber-500"
                    value={warningDays}
                    onChange={(e) => setWarningDays(Number(e.target.value))}
                  />
                </div>
              </div>
            </div>

            <div className="border-b border-zinc-700 p-3">
              <LayerPanel
                elements={elements}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onReorder={handleReorder}
                onDelete={handleDeleteElement}
              />
            </div>

            <div className="p-3">
              {selectedElement ? (
                <PropertiesPanel
                  element={selectedElement}
                  onChange={handleUpdateElement}
                  fonts={fonts}
                  onUploadFont={handleUploadFont}
                  images={images}
                  onUploadImage={handleUploadImage}
                />
              ) : (
                <p className="mt-4 text-center text-xs text-zinc-500">
                  Select an element to edit its properties
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default OverlayKometaPage
