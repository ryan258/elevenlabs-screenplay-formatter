# Roadmap — ElevenLabs Screenplay Formatter

This roadmap focuses on future enhancements and remaining quality-of-life improvements. For completed features, see [CHANGELOG.md](./CHANGELOG.md).

---

## Current Status

**Version 0.4.0** has shipped with comprehensive features:
- ✅ Full screenplay parsing with Fountain support
- ✅ ElevenLabs integration with all voice models
- ✅ Project management and voice presets
- ✅ Timeline view and per-line preview
- ✅ Export to multiple formats (ZIP, Reaper, SRT/VTT)
- ✅ CLI for batch processing
- ✅ Audio production with SFX and background music
- ✅ Shareable project URLs
- ✅ Core stability fixes (IndexedDB migration, memory leaks, error handling)

---

## Future Enhancements

### Testing & Quality Assurance

**Goal:** Improve reliability and prevent regressions through automated testing.

- [ ] **Parser unit tests**
  - [ ] Test various real-world edge cases (unusual formatting, mixed case, special characters)
  - [ ] Validate Fountain parsing corner cases
  - [ ] Test character alias resolution

- [ ] **API client tests**
  - [ ] Mock ElevenLabs API responses
  - [ ] Test retry logic and rate limiting
  - [ ] Validate error handling and recovery

- [ ] **End-to-end tests** (Playwright/Cypress)
  - [ ] Load test script and assign voices
  - [ ] Mock API responses and verify UI flow
  - [ ] Test project save/load cycle
  - [ ] Validate resume functionality

- [ ] **Maintenance scripts**
  - [ ] GitHub Actions workflow for lint + tests on push/PR
  - [ ] Automated build verification

### Parser Enhancements

- [ ] **Parser diagnostics mode**
  - [ ] Optional "show parsed view" that lists detected characters and their lines
  - [ ] Highlight lines that failed to parse for user debugging
  - [ ] Character detection confidence scores

### Workflow & Automation

- [ ] **Batch processing improvements**
  - [ ] Sequential processing of multiple screenplay files (chapters/episodes)
  - [ ] Rate-limiting and cooldown between runs
  - [ ] Progress tracking across multiple files
  - [ ] Batch configuration presets

### Error Handling & Resilience

- [ ] **Better error recovery**
  - [ ] Automatic retry for transient network failures
  - [ ] Improved localStorage/IndexedDB corruption handling
  - [ ] Graceful degradation when backend is unavailable

- [ ] **Script validation**
  - [ ] Character/word count display
  - [ ] Estimated API cost calculator
  - [ ] Warning before processing extremely large scripts (50K+ words)
  - [ ] Memory usage estimation

### Developer Experience

- [ ] **Server package.json**
  - [ ] Create `server/package.json` with proper dependencies
  - [ ] Document express, cors, multer, fluent-ffmpeg versions
  - [ ] Add server-specific scripts

### Integrations & Export Formats

- [ ] **Enhanced Reaper integration**
  - [ ] Export formats tailored for Reaper track templates
  - [ ] Marker/region generation for dialogue sections
  - [ ] Automatic track coloring by character

- [ ] **Additional DAW exports**
  - [ ] Pro Tools session templates
  - [ ] Logic Pro project format
  - [ ] Studio One export

### Backlog / Nice-to-Have Ideas

Ideas to revisit after core stability and testing are solid:

- [ ] **Advanced audio processing**
  - [ ] Real-time waveform preview
  - [ ] Basic audio normalization
  - [ ] Automatic silence trimming

- [ ] **Collaboration features**
  - [ ] Multi-user project editing (if needed)
  - [ ] Version history and diff view
  - [ ] Comment threads on dialogue lines

- [ ] **Cloud integration**
  - [ ] Optional cloud storage for projects
  - [ ] Sync across devices
  - [ ] Team libraries for voice presets

---

## Contributing

See [ARCHITECTURE.md](./ARCHITECTURE.md) for system overview and [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines.

---

## Version History

- **v0.4.0** (2025-11-28) - Comprehensive feature release with all core functionality
- **v0.3.x** - Workflow automation and CLI
- **v0.2.x** - Parsing enhancements and UX improvements
- **v0.1.x** - MVP polishing and stability

See [CHANGELOG.md](./CHANGELOG.md) for detailed release notes.
