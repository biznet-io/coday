import { VoiceSynthesisComponent } from './voice-synthesis/voice-synthesis.component'
import { getPreference, setPreference } from './utils/preferences'

// Initialize voice synthesis component
export const voiceSynthesis = new VoiceSynthesisComponent()
const voiceAnnounceToggle = document.getElementById('voice-announce-toggle') as HTMLInputElement
const voiceModeSelect = document.getElementById('voice-mode-select') as HTMLSelectElement
const voiceSelectionContainer = document.getElementById('voice-selection-container') as HTMLDivElement
const voiceSelect = document.getElementById('voice-select') as HTMLSelectElement
const voiceLanguageSelect = document.getElementById('voice-language-select') as HTMLSelectElement
const voiceRateSelect = document.getElementById('voice-rate-select') as HTMLSelectElement
const voiceVolumeSlider = document.getElementById('voice-volume-slider') as HTMLInputElement
const volumeDisplay = document.getElementById('volume-display') as HTMLSpanElement
const voiceVolumeControl = document.getElementById('voice-volume-control') as HTMLDivElement
const voiceReadFullToggle = document.getElementById('voice-read-full-toggle') as HTMLInputElement

const voiceOptions = document.getElementById('voice-options') as HTMLDivElement

// Set initial voice language based on stored preference
const savedVoiceLanguage = getPreference<string>('voiceLanguage', 'en-US') || 'en-US'
voiceLanguageSelect.value = savedVoiceLanguage
voiceSynthesis.language = savedVoiceLanguage

// Set initial voice announce state based on stored preference
const voiceAnnounceEnabled = getPreference('voiceAnnounceEnabled', false)
voiceAnnounceToggle.checked = voiceAnnounceEnabled !== undefined ? voiceAnnounceEnabled : false

// Set initial voice mode based on stored preference
const savedVoiceMode = getPreference<string>('voiceMode', 'speech') || 'speech'
voiceModeSelect.value = savedVoiceMode

// Set initial selected voice
const selectedVoice = getPreference<string>('selectedVoice', '')
voiceSynthesis.setSelectedVoice(selectedVoice)

// Set initial speech rate based on stored preference
const savedSpeechSpeed = getPreference<string>('speechSpeed', '1.2') || '1.2'
voiceRateSelect.value = savedSpeechSpeed
voiceSynthesis.rate = parseFloat(savedSpeechSpeed)

// Set initial speech volume based on stored preference
const savedSpeechVolume = getPreference<number>('speechVolume', 80) || 80
voiceVolumeSlider.value = savedSpeechVolume.toString()
volumeDisplay.textContent = `${savedSpeechVolume}%`
voiceSynthesis.volume = savedSpeechVolume / 100

// Set initial read full text preference
const readFullText = getPreference<boolean>('voiceReadFullText', false)
voiceReadFullToggle.checked = readFullText !== undefined ? readFullText : false

// Show/hide voice selection based on mode
export function updateVoiceSelectionVisibility() {
  const showVoiceSelection = voiceAnnounceToggle.checked && voiceModeSelect.value === 'speech'
  voiceSelectionContainer.style.display = showVoiceSelection ? 'block' : 'none'
  voiceVolumeControl.style.display = showVoiceSelection ? 'flex' : 'none'

  if (showVoiceSelection) {
    populateVoiceSelect()
  }
}

// Show/hide voice options based on toggle state
export function updateVoiceOptionsVisibility() {
  voiceOptions.style.display = voiceAnnounceToggle.checked ? 'block' : 'none'
  voiceVolumeControl.style.display = voiceAnnounceToggle.checked && voiceModeSelect.value === 'speech' ? 'flex' : 'none'
  updateVoiceSelectionVisibility()
}

// Populate voice selector using voice synthesis component
async function populateVoiceSelect() {
  try {
    // Add loading indicator
    voiceSelect.innerHTML = '<option value="">Loading voices...</option>'

    const voices = await voiceSynthesis.getVoices()
    console.log('[VOICE] Populate voice select with', voices.length, 'voices for language:', voiceSynthesis.language)

    voiceSelect.innerHTML = ''

    if (voices.length === 0) {
      voiceSelect.innerHTML = '<option value="">No voices available for this language</option>'
      console.warn('[VOICE] No voices found for language:', voiceSynthesis.language)
      return
    }

    // Add each voice as an option
    voices.forEach((voice) => {
      const option = document.createElement('option')
      option.value = `${voice.name}|${voice.lang}` // Store both name and lang
      option.textContent = voice.displayName // Already formatted by component
      voiceSelect.appendChild(option)
    })

    // Restore saved voice preference if it exists
    const savedVoice = voiceSynthesis.selectedVoice
    if (savedVoice) {
      const savedValue = `${savedVoice.name}|${savedVoice.lang}`
      voiceSelect.value = savedValue
      console.log('[VOICE] Restored saved voice preference:', savedVoice)
    } else {
      console.log('[VOICE] No saved voice preference found')
    }
  } catch (error) {
    console.error('[VOICE] Error populating voice select:', error)
    voiceSelect.innerHTML = '<option value="">Error loading voices</option>'
  }
}

voiceLanguageSelect.addEventListener('change', () => {
  setPreference('voiceLanguage', voiceLanguageSelect.value)
  voiceSynthesis.language = voiceLanguageSelect.value
  populateVoiceSelect()
  // Trigger custom event to notify chat component of language change
  window.dispatchEvent(new CustomEvent('voiceLanguageChanged', { detail: voiceLanguageSelect.value }))
})

voiceAnnounceToggle.addEventListener('change', () => {
  setPreference('voiceAnnounceEnabled', voiceAnnounceToggle.checked)
  updateVoiceOptionsVisibility()
  if (voiceAnnounceToggle.checked) {
    testAudioAnnouncement()
  }
  // Dispatch event to notify components of voice announce change
  window.dispatchEvent(new CustomEvent('voiceAnnounceEnabledChanged', { detail: voiceAnnounceToggle.checked }))
})

voiceModeSelect.addEventListener('change', () => {
  setPreference('voiceMode', voiceModeSelect.value)
  updateVoiceSelectionVisibility()
  testAudioAnnouncement()
  // Dispatch event to notify components of mode change
  window.dispatchEvent(new CustomEvent('voiceModeChanged', { detail: voiceModeSelect.value }))
})

voiceSelect.addEventListener('change', () => {
  const selectedValue = voiceSelect.value

  if (selectedValue) {
    setPreference('selectedVoice', selectedValue)
    voiceSynthesis.setSelectedVoice(selectedValue)
    voiceSynthesis.testSelectedVoice()
  } else {
    // Clear preference otherwise
    setPreference('selectedVoice', '')
  }
})

voiceRateSelect.addEventListener('change', () => {
  const selectedRate = voiceRateSelect.value
  setPreference('speechSpeed', selectedRate)
  voiceSynthesis.rate = parseFloat(selectedRate)
  voiceSynthesis.testSelectedVoice()
})

voiceVolumeSlider.addEventListener('input', () => {
  const volumeValue = parseInt(voiceVolumeSlider.value)
  volumeDisplay.textContent = `${volumeValue}%`
  setPreference('speechVolume', volumeValue)
  voiceSynthesis.volume = volumeValue / 100
})

voiceReadFullToggle.addEventListener('change', () => {
  setPreference('voiceReadFullText', voiceReadFullToggle.checked)
  // Dispatch event to notify chat history component
  window.dispatchEvent(new CustomEvent('voiceReadFullTextChanged', { detail: voiceReadFullToggle.checked }))
})

function testAudioAnnouncement() {
  const mode = voiceModeSelect.value

  if (mode === 'notification') {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      oscillator.frequency.setValueAtTime(800, audioContext.currentTime)
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1)

      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.1)
    } catch (error) {
      console.error('[VOICE] Notification sound test failed:', error)
    }
  } else if (mode === 'speech') {
    voiceSynthesis.testSelectedVoice()
  }
}

// Initialize the page
function initializePreferences() {
  updateVoiceOptionsVisibility()

  // Populate voices after a small delay to ensure DOM is ready
  setTimeout(() => {
    populateVoiceSelect()
  }, 100)
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePreferences)
} else {
  initializePreferences()
}
