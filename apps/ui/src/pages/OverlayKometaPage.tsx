import { Listbox, Switch, Transition } from '@headlessui/react'
import { Fragment, useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { useOverlaySettings, useUpdateOverlaySettings } from '../api/overlays'
import SaveButton from '../components/Common/SaveButton'
import { Input } from '../components/Forms/Input'

const BACKGROUND_OPTIONS = [
  { id: 'none', name: 'No background' },
  { id: 'filme', name: 'Filme' },
  { id: 'serien', name: 'Serien' },
  { id: 'anime', name: 'Anime' },
  { id: 'test', name: 'Test' },
]

const OverlayKometaPage = () => {
  const { data: settings, isLoading } = useOverlaySettings()
  const updateSettings = useUpdateOverlaySettings()

  const [enabled, setEnabled] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // --- Vorschau Settings ---
  const [previewBg, setPreviewBg] = useState(BACKGROUND_OPTIONS[0])
  const [previewMode, setPreviewMode] = useState<'urgent' | 'warning'>('urgent')

  // --- Gemeinsame Banner Koordinaten (Einheitlich!) ---
  const [bannerX, setBannerX] = useState(16)
  const [bannerY, setBannerY] = useState(16)
  const [bannerW, setBannerW] = useState(120)
  const [bannerH, setBannerH] = useState(32)

  // --- Schwellenwerte & Farben ---
  const [urgentDays, setUrgentDays] = useState(3)
  const [urgentColor, setUrgentColor] = useState('#E31E24')

  const [warningDays, setWarningDays] = useState(10)
  const [warningColor, setWarningColor] = useState('#F1C40F')

  const [textColor, setTextColor] = useState('#FFFFFF')

  useEffect(() => {
    if (settings) {
      setEnabled(settings.kometaEnabled ?? false)
      setUrgentDays(settings.kometaUrgentDays ?? 3)
      setUrgentColor(settings.kometaUrgentColor ?? '#E31E24')
      setWarningDays(settings.kometaWarningDays ?? 10)
      setWarningColor(settings.kometaWarningColor ?? '#F1C40F')
      setTextColor(settings.kometaTextColor ?? '#FFFFFF')
      // TODO: bannerX, bannerY, bannerW, bannerH aus DB laden
    }
  }, [settings])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await updateSettings.mutateAsync({
        kometaEnabled: enabled,
        kometaUrgentDays: urgentDays,
        kometaUrgentColor: urgentColor,
        kometaWarningDays: warningDays,
        kometaWarningColor: warningColor,
        kometaTextColor: textColor,
        // TODO: bannerX, bannerY, bannerW, bannerH ans Backend senden
      })
      toast.success('Kometa settings saved successfully!')
    } catch (err) {
      toast.error('Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return <div className="text-gray-400">Loading Kometa settings...</div>
  }

  return (
    <div className="h-full w-full">
      <div className="section w-full">
        <h3 className="heading">Kometa Export Integration</h3>
        <p className="description">
          Configure automatic yaml generation of days-left data for your Kometa
          instances.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-6 rounded-lg border border-zinc-800 bg-zinc-900 p-6 lg:col-span-2">
          <div className="space-y-6 border-b border-zinc-800 pb-6">
            <div className="flex items-center justify-between">
              <div>
                <label className="block font-semibold text-white">
                  Live Preview Background
                </label>
                <span className="text-sm text-gray-400">
                  Select a library section to preview the banners.
                </span>
              </div>
              <div className="w-56">
                <Listbox value={previewBg} onChange={setPreviewBg}>
                  <div className="relative mt-1">
                    <Listbox.Button className="relative w-full cursor-pointer rounded-md border border-zinc-700 bg-zinc-800 py-2 pl-3 pr-10 text-left text-sm text-white shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500">
                      <span className="block truncate">{previewBg.name}</span>
                      <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-zinc-400">
                        <svg
                          className="h-5 w-5"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </span>
                    </Listbox.Button>
                    <Transition
                      as={Fragment}
                      leave="transition ease-in duration-100"
                      leaveFrom="opacity-100"
                      leaveTo="opacity-0"
                    >
                      <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-zinc-700 bg-zinc-800 py-1 text-sm shadow-lg focus:outline-none">
                        {BACKGROUND_OPTIONS.map((option) => (
                          <Listbox.Option
                            key={option.id}
                            className={({ active }) =>
                              `relative cursor-pointer select-none py-2 pl-3 pr-9 ${active ? 'bg-blue-600 text-white' : 'text-gray-300'}`
                            }
                            value={option}
                          >
                            {({ selected }) => (
                              <span
                                className={`block truncate ${selected ? 'font-medium text-white' : 'font-normal'}`}
                              >
                                {option.name}
                              </span>
                            )}
                          </Listbox.Option>
                        ))}
                      </Listbox.Options>
                    </Transition>
                  </div>
                </Listbox>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="block font-semibold text-white">
                  Enable Kometa Export
                </label>
                <span className="text-sm text-gray-400">
                  Generates a Kometa-compatible YAML overlay file.
                </span>
              </div>
              <Switch
                checked={enabled}
                onChange={setEnabled}
                className={`${enabled ? 'bg-amber-600' : 'bg-zinc-700'} relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-zinc-900`}
              >
                <span
                  className={`${enabled ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out`}
                />
              </Switch>
            </div>
          </div>

          {enabled && (
            <div className="space-y-8 transition-all duration-300">
              <div className="flex items-center justify-center space-x-4 rounded-md bg-zinc-950 p-4">
                <span
                  className={`text-sm font-bold uppercase ${previewMode === 'urgent' ? 'text-amber-500' : 'text-zinc-500'}`}
                >
                  Urgent Visuals
                </span>
                <Switch
                  checked={previewMode === 'warning'}
                  onChange={(val) => setPreviewMode(val ? 'warning' : 'urgent')}
                  className={`${previewMode === 'warning' ? 'bg-zinc-700' : 'bg-zinc-700'} relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-zinc-900`}
                >
                  <span
                    className={`${previewMode === 'warning' ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out`}
                  />
                </Switch>
                <span
                  className={`text-sm font-bold uppercase ${previewMode === 'warning' ? 'text-amber-500' : 'text-zinc-500'}`}
                >
                  Warning Visuals
                </span>
              </div>

              <div className="rounded-md border border-zinc-700 bg-zinc-800/50 p-4">
                <h4 className="mb-1 block text-sm font-bold text-white">
                  Banner Position & Size
                </h4>
                <div className="mb-2 mt-3 block text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Properties
                </div>

                <div className="grid grid-cols-4 gap-x-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase text-zinc-500">
                      X
                    </label>
                    <input
                      type="number"
                      className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      value={bannerX}
                      onChange={(e) => setBannerX(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase text-zinc-500">
                      Y
                    </label>
                    <input
                      type="number"
                      className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      value={bannerY}
                      onChange={(e) => setBannerY(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase text-zinc-500">
                      W
                    </label>
                    <input
                      type="number"
                      className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      value={bannerW}
                      onChange={(e) => setBannerW(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase text-zinc-500">
                      H
                    </label>
                    <input
                      type="number"
                      className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      value={bannerH}
                      onChange={(e) => setBannerH(Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-bold text-white">
                    Urgent Threshold (Days)
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="15"
                    className="w-full accent-amber-500"
                    value={urgentDays}
                    onChange={(e) => setUrgentDays(Number(e.target.value))}
                  />
                  <span className="text-xs text-gray-400">
                    {urgentDays} days or less
                  </span>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-bold text-white">
                    Urgent Banner Color
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      className="h-9 w-9 cursor-pointer rounded border-0 bg-transparent"
                      value={urgentColor}
                      onChange={(e) => setUrgentColor(e.target.value)}
                    />
                    <div className="w-32">
                      <Input
                        name="urgentColor"
                        type="text"
                        className="font-mono uppercase"
                        value={urgentColor}
                        onChange={(e) => setUrgentColor(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-bold text-white">
                    Warning Threshold (Days)
                  </label>
                  <input
                    type="range"
                    min="2"
                    max="30"
                    className="w-full accent-amber-500"
                    value={warningDays}
                    onChange={(e) => setWarningDays(Number(e.target.value))}
                  />
                  <span className="text-xs text-gray-400">
                    {warningDays} days or less
                  </span>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-bold text-white">
                    Warning Banner Color
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      className="h-9 w-9 cursor-pointer rounded border-0 bg-transparent"
                      value={warningColor}
                      onChange={(e) => setWarningColor(e.target.value)}
                    />
                    <div className="w-32">
                      <Input
                        name="warningColor"
                        type="text"
                        className="font-mono uppercase"
                        value={warningColor}
                        onChange={(e) => setWarningColor(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-bold text-white">
                    Banner Text Color
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    className="h-9 w-9 cursor-pointer rounded border-0 bg-transparent"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                  />
                  <div className="w-32">
                    <Input
                      name="textColor"
                      type="text"
                      className="font-mono uppercase"
                      value={textColor}
                      onChange={(e) => setTextColor(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-zinc-800 pt-4">
                <label className="mb-2 block text-sm font-bold text-zinc-300">
                  Docker-Compose Mount Setup
                </label>
                <p className="mb-3 text-xs text-gray-400">
                  Mount this folder into your Kometa container.
                </p>
                <pre className="overflow-x-auto rounded border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs text-amber-500">
                  {`volumes:\n  - /your-host-path/maintainerr/data/kometa_overlays:/config/overlays:ro`}
                </pre>
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-end border-t border-zinc-800 pt-4">
            <SaveButton
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              isPending={isSaving}
              label="Save Changes"
              pendingLabel="Saving..."
            />
          </div>
        </div>

        <div className="flex flex-col items-center justify-start rounded-lg border border-zinc-800/80 bg-zinc-900/50 p-6">
          <span className="mb-4 text-sm font-bold uppercase tracking-wider text-zinc-400">
            Live UI Preview
          </span>

          <div className="relative flex h-96 w-64 items-center justify-center overflow-hidden rounded-lg border border-zinc-700 bg-zinc-800 shadow-2xl">
            <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-zinc-950 via-zinc-900 to-zinc-800 p-4">
              <span className="mb-12 text-center text-lg font-bold uppercase tracking-widest text-zinc-500">
                {previewBg.id === 'none'
                  ? 'No Background'
                  : `${previewBg.name} Poster`}
              </span>
            </div>

            {enabled && (
              <div
                style={{
                  position: 'absolute',
                  left: `${bannerX}px`,
                  top: `${bannerY}px`,
                  width: `${bannerW}px`,
                  height: `${bannerH}px`,
                  backgroundColor:
                    previewMode === 'urgent' ? urgentColor : warningColor,
                  color: textColor,
                }}
                className="flex items-center justify-center rounded-xl px-2 text-sm font-bold shadow-lg transition-colors duration-200"
              >
                Noch {previewMode === 'urgent' ? urgentDays : warningDays} Tage
              </div>
            )}
          </div>

          <p className="mt-4 max-w-[240px] text-center text-xs text-gray-400">
            Previewing{' '}
            <strong
              style={{
                color: previewMode === 'urgent' ? urgentColor : warningColor,
              }}
            >
              {previewMode}
            </strong>{' '}
            visuals.
          </p>
        </div>
      </div>
    </div>
  )
}

export default OverlayKometaPage
