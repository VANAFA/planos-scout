#!/usr/bin/env python3
"""
Helper script to run Scout 3D presets easily.

Usage:
    python run_preset.py [preset_name] [--export] [--show]

Examples:
    python run_preset.py mangrullo          # Run mangrullo preset
    python run_preset.py estrella --export  # Run estrella and export files
    python run_preset.py torre_simple       # Run torre_simple preset
    python run_preset.py list               # List all available presets
"""

import sys
import os

# Agregar el directorio raíz al path de Python
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from presets import PRESETS, listar_presets
from engine import Engine3D


def run_preset(preset_name, export=False, show=True):
    """
    Ejecuta un preset específico.
    
    Args:
        preset_name (str): Nombre del preset a ejecutar
        export (bool): Si True, exporta JSON, PDF y GIF
        show (bool): Si True, muestra la visualización 3D
    """
    if preset_name == 'list':
        listar_presets()
        return
    
    if preset_name not in PRESETS:
        print(f"\n❌ ERROR: Preset '{preset_name}' not found.")
        print(f"   Available presets: {', '.join(PRESETS.keys())}")
        listar_presets()
        return
    
    info = PRESETS[preset_name]
    print(f"\n{'='*60}")
    print(f"SCOUT 3D PRESET: {preset_name}")
    print(f"{'='*60}")
    print(f"✓ {info['nombre']}")
    print(f"  {info['descripcion']}\n")
    
    print("Building structure...")
    engine = Engine3D()
    engine = info['funcion'](engine)
    
    if export:
        print("\nExporting files...")
        print(engine.generar_resumen_montaje_texto())
        engine.exportar_proyecto_json("proyecto_scout.json")
        print("  ✓ proyecto_scout.json")
        engine.exportar_manual_pdf(
            "manual_scout.pdf", 
            titulo=f"Manual Scout - {info['nombre']}"
        )
        print("  ✓ manual_scout.pdf")
        engine.exportar_gif_rotacion_horizontal(
            "rotacion_scout.gif",
            segundos=6,
            elevacion=20,
            mostrar_intersecciones=True,
        )
        print("  ✓ rotacion_scout.gif")
    
    if show:
        print("\nStarting 3D visualization...")
        engine.show(mostrar_intersecciones=True)


def main():
    """Procesa argumentos de línea de comandos."""
    if len(sys.argv) < 2:
        print(__doc__)
        listar_presets()
        sys.exit(1)
    
    preset_name = sys.argv[1]
    export = '--export' in sys.argv
    show = '--no-show' not in sys.argv
    
    run_preset(preset_name, export=export, show=show)


if __name__ == "__main__":
    main()
