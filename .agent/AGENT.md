# Cosmic Atlas - AI Agent Guide

Welcome to the **Cosmic Atlas** development environment. This project is a high-performance 3D space exploration application built with Next.js, React Three Fiber, and Three.js.

## Project Context
- **Core Stack**: React 19, Next.js 15+, Three.js, React Three Fiber (R3F).
- **Design System**: SCSS + Tailwind CSS v4. Glassmorphism aesthetic.
- **Visuals**: Realistic celestial bodies with custom shaders, post-processing (Bloom, Noise), and cinematic overlays.
- **Optimization**: Uses KTX2 textures and GLB models for high efficiency.

## Key Directories
- `src/components/scene`: R3F components, shaders, and 3D logic.
- `src/components/ui`: React UI components (HUD, Overlays).
- `src/components/state`: Global application state (Zustand-like or Context).
- `src/lib`: Utility functions (astronomy, audio, math).
- `public/assets`: Texture and model repositories.

## Development Guidelines
1. **Performance First**: Always use `useMemo` for heavy Three.js objects or materials. Use `useFrame` sparingly.
2. **Design Language**: Maintain the "Scientific Instrument" aesthetic—monospaced fonts, neon accents, and subtle glass backgrounds.
3. **Asset Handling**: Prefer KTX2 textures for GPU memory efficiency. Use `useKTX2` loader.
4. **Shaders**: When modifying atmospheres or celestial surfaces, prioritize GLSL performance and realism.

## Workflow Integration
Use the provided workflows in `.agent/workflows/` for common tasks like asset fetching or scene deployment.
