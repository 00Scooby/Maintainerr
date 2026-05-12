import { Switch } from '@headlessui/react'
import {
  CloudDownloadIcon,
  InformationCircleIcon,
  RefreshIcon,
} from '@heroicons/react/solid'
import type { OverlayElement } from '@maintainerr/contracts'
import { POSTER_CANVAS } from '@maintainerr/contracts'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import {
  buildItemImageUrl,
  exportKometaCollection,
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
import GetApiHandler from '../utils/ApiHandler'

const OverlayKometaPage = () => {
  const { data: settings, isLoading: isSettingsLoading } = useOverlaySettings()
  const updateSettings = useUpdateOverlaySettings()

  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)

  // --- Globals ---
  const [enabled, setEnabled] = useState(() => settings?.kometaEnabled ?? false)
  const [previewMode, setPreviewMode] = useState<'urgent' | 'warning'>('urgent')

  // --- Editor State ---
  const [collections, setCollections] = useState<
    { id: number; title: string }[]
  >([])
  const [selectedCollection, setSelectedCollection] = useState('')

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

  const canvasDefaults = POSTER_CANVAS

  const {
    current: elements,
    set: setElements,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useUndoRedo<OverlayElement[]>([])

  const selectedElement = useMemo(
    () => elements.find((el) => el.id === selectedId) ?? null,
    [elements, selectedId],
  )

  // --- Initial Load from DB ---
  useEffect(() => {
    if (settings) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEnabled(settings.kometaEnabled ?? false)

      // Lade das gespeicherte Design in den Canvas (falls vorhanden)
      if (
        settings.kometaElements &&
        settings.kometaElements.length > 0 &&
        elements.length === 0
      ) {
        setElements(settings.kometaElements)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings])

  // --- Load Assets ---
  useEffect(() => {
    void GetApiHandler<any[]>('/collections')
      .then((c) => {
        if (c) setCollections(c)
      })
      .catch(() => toast.warning('Could not load collections.'))

    void getOverlaySections()
      .then((s) => {
        if (s) setSections(s)
      })
      .catch(() => toast.warning('Could not load libraries.'))

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

  // --- Handlers ---
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

  const handleSave = async () => {
    setSaving(true)
    try {
      // HIER WIRD DAS DESIGN JETZT IN DER DATENBANK GESPEICHERT!
      await updateSettings.mutateAsync({
        kometaEnabled: enabled,
        kometaElements: elements,
      } as any) // 'as any' als Notfall-Pflaster, falls du Schritt 1 noch nicht gemacht hast
      toast.success('Design saved successfully!')
    } catch (err) {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleExportNow = async () => {
    if (!selectedCollection) {
      toast.info('Please select a target collection first.')
      return
    }
    setExporting(true)
    try {
      await exportKometaCollection({
        collectionId: selectedCollection,
        elements,
      } as any)
      const collectionTitle =
        collections.find((c) => c.id.toString() === selectedCollection)
          ?.title || 'Collection'
      toast.success(`Export for "${collectionTitle}" triggered!`)
    } catch (err) {
      toast.error('Export failed.')
    } finally {
      setExporting(false)
    }
  }

  // --- Vorschau Handlers ---
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

  if (isSettingsLoading)
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner />
      </div>
    )

  return (
    <>
      <div className="section">
        <h3 className="heading">Kometa Export Design</h3>
        <p className="description">
          Design your smart countdown banners. Thresholds and colors are set
          individually on each element.
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-amber-500/90">
          <InformationCircleIcon className="h-3.5 w-3.5 shrink-0" />
          <span>
            To use overlays, map your export folder in docker-compose:
            <code className="ml-1 rounded border border-amber-500/20 bg-amber-950/20 px-1.5 py-0.5 text-zinc-300">
              - ./data/kometa_export:/app/kometa_export
            </code>
          </span>
        </p>
      </div>

      <PageControlRow
        actions={
          <>
            <div className="flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-white">
                Export
              </span>
              <Switch
                checked={enabled}
                onChange={setEnabled}
                className={`${enabled ? 'bg-amber-600' : 'bg-zinc-700'} relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none`}
              >
                <span
                  className={`${enabled ? 'translate-x-3' : 'translate-x-0'} pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                />
              </Switch>
            </div>

            <div className="mx-1 h-6 w-px bg-zinc-700" />

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
              label="Save Design"
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

            <div className="mx-2 h-6 w-px bg-zinc-700" />

            <div className="flex items-center justify-center space-x-3 rounded-md border border-zinc-700 bg-zinc-900 p-2 text-xs">
              <span
                className={`font-bold uppercase ${previewMode === 'urgent' ? 'text-amber-500' : 'text-zinc-500'}`}
              >
                Urgent
              </span>
              <Switch
                checked={previewMode === 'warning'}
                onChange={(val) => setPreviewMode(val ? 'warning' : 'urgent')}
                className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-zinc-700 transition-colors duration-200 ease-in-out focus:outline-none"
              >
                <span
                  className={`${previewMode === 'warning' ? 'translate-x-4' : 'translate-x-0'} pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                />
              </Switch>
              <span
                className={`font-bold uppercase ${previewMode === 'warning' ? 'text-amber-500' : 'text-zinc-500'}`}
              >
                Warning
              </span>
            </div>

            <div className="mx-2 h-6 w-px bg-zinc-700" />

            {/* NEU: Zwei Dropdowns! Eins für die Vorschau, eins für den Export */}
            <div className="flex items-center gap-2">
              <Select
                className="w-48 text-sm"
                name="preview-section"
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
              >
                <option value="">Preview Background...</option>
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
                  title="Load random poster"
                >
                  <RefreshIcon className="h-4 w-4" />
                </button>
              )}

              <div className="mx-1 h-6 w-px bg-zinc-700" />

              <Select
                className="w-56 text-sm"
                name="target-collection"
                value={selectedCollection}
                onChange={(e) => setSelectedCollection(e.target.value)}
              >
                <option value="">Target Collection...</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id.toString()}>
                    {c.title}
                  </option>
                ))}
              </Select>

              {selectedCollection && (
                <Button
                  buttonType="primary"
                  className="flex h-9 items-center gap-2 px-3"
                  onClick={handleExportNow}
                  disabled={exporting}
                >
                  {exporting ? (
                    <LoadingSpinner />
                  ) : (
                    <CloudDownloadIcon className="h-4 w-4" />
                  )}
                  <span>Export Now</span>
                </Button>
              )}
            </div>
          </>
        }
        controlsClassName="sm:w-auto"
      />

      <div className="mt-4 flex h-[60vh] min-h-[24rem] flex-col border-t border-zinc-700 lg:flex-row">
        <div className="hidden w-48 shrink-0 overflow-y-auto border-r border-zinc-700 p-3 lg:block">
          <ElementToolbox
            mode="poster"
            onAdd={handleAddElement}
            nextLayerOrder={elements.length}
          />
        </div>

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
            kometaPreviewMode={previewMode}
          />
        </div>

        <div className="hidden w-72 shrink-0 overflow-y-auto border-l border-zinc-700 bg-zinc-900/30 lg:block">
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
    </>
  )
}

export default OverlayKometaPage
