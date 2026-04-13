# 🏗️ Scout 3D - Guía de Estructuras Predefinidas

## Resumen Rápido

Este proyecto ahora incluye un **sistema de estructuras predefinidas** (presets) para visualizar y analizar diferentes construcciones scout de forma rápida.

### ¿Qué es un Preset?

Un preset es una estructura scout completa, pre-construida y lista para visualizar. Cada preset:
- Define todos los palos, sogas, trípodes, etc.
- Organiza el montaje en pasos lógicos
- Genera automáticamente PDF, JSON y GIF
- Se puede visualizar en 3D interactivo

### Presets Disponibles

| Nombre | Archivo | Descripción |
|--------|---------|-------------|
| **Mangrullo** | `presets/mangrullo.py` | Torre con 2 estructuras cuadradas conectadas por puente |
| **Estrella Scout** | `presets/estrella.py` | Hexagrama con 3 trípodes y 2 triángulos superpuestos |
| **Torre Simple** | `presets/torre_simple.py` | Torre de una columna con múltiples plataformas |

---

## 🚀 Uso Rápido

### Opción 1: Script Helper (MÁS FÁCIL)

```bash
# Listar todos los presets
python run_preset.py list

# Ejecutar un preset y visualizar
python run_preset.py mangrullo       # Torre mangrullo
python run_preset.py estrella        # Estrella scout
python run_preset.py torre_simple    # Torre simple

# Ejecutar y exportar (JSON, PDF, GIF)
python run_preset.py estrella --export

# Ejecutar sin mostrar visualización 3D
python run_preset.py estrella --no-show
```

### Opción 2: Main Selector 

Edita `main_selector.py` y cambia:

```python
PRESET_SELECCIONADO = 'mangrullo'  # Cambia a 'estrella' o 'torre_simple'
```

Luego ejecuta:
```bash
python main_selector.py
```

### Opción 3: Importar en Tu Código

```python
from presets import construir_mangrullo, construir_estrella, construir_torre_simple

# Opción A: Crear estructura nueva
engine = construir_mangrullo()

# Opción B: Agregar a engine existente
from engine import Engine3D
engine = Engine3D()
engine = construir_estrella(engine)

# Visualizar
engine.show(mostrar_intersecciones=True)
```

---

## 📁 Estructura de Archivos

```
Planos Scout/
├── main.py                    # Código original del mangrullo
├── main_selector.py           # Selector con interfaz al usuario
├── run_preset.py              # Script helper para ejecutar presets
├── engine.py                  # Motor 3D (no modificar)
├── proyecto_scout.json        # Exportación (generado)
├── manual_scout.pdf           # Manual (generado)
├── rotacion_scout.gif         # Rotación 360° (generado)
│
└── presets/                   # Carpeta de estructuras predefinidas
    ├── __init__.py            # Gestor de presets
    ├── README.md              # Documentación de presets
    ├── mangrullo.py           # Estructura: Mangrullo
    ├── estrella.py            # Estructura: Estrella Scout
    └── torre_simple.py        # Estructura: Torre Simple
```

---

## 🎯 Ejemplos de Uso

### Ejemplo 1: Ver la estrella en 3D

```bash
python run_preset.py estrella
```

Esto:
1. Construye la estructura de la estrella scout
2. Abre la visualización 3D interactiva
3. Muestra el hexagrama con 3 trípodes

### Ejemplo 2: Generar documentación de una estructura

```bash
python run_preset.py torre_simple --export
```

Genera:
- `proyecto_scout.json` - Datos de la estructura (para importar/analizar)
- `manual_scout.pdf` - Manual paso a paso en PDF
- `rotacion_scout.gif` - Rotación 360° de la estructura

### Ejemplo 3: Cambiar entre presets fácilmente

```python
from presets import PRESETS

# Cambiar entre estructuras dinámicamente
for preset_name in ['mangrullo', 'estrella', 'torre_simple']:
    engine = PRESETS[preset_name]['funcion']()
    print(f"Visualizando {preset_name}...")
    engine.show(mostrar_intersecciones=True)
```

---

## ➕ Cómo Agregar Tu Propia Estructura

### Paso 1: Crear archivo

```bash
# Crear nuevo archivo de preset
cat > presets/mi_estructura.py << 'EOF'
from engine import Engine3D

def construir_mi_estructura(engine=None):
    if engine is None:
        engine = Engine3D()
        engine.set_modo_rapido(True)
    
    # Aquí va el código de tu estructura
    # engine.palo(...)
    # engine.tripode(...)
    # engine.registrar_comentario_paso(...)
    
    return engine
EOF
```

### Paso 2: Registrar en `__init__.py`

Abre `presets/__init__.py` y agrega:

```python
from .mi_estructura import construir_mi_estructura

PRESETS = {
    # ... presets existentes ...
    'mi_estructura': {
        'nombre': 'Mi Estructura',
        'descripcion': 'Descripción breve de tu estructura',
        'funcion': construir_mi_estructura,
    },
}
```

### Paso 3: Usar

```bash
python run_preset.py mi_estructura
```

---

## 📊 Estructura de un Preset (Plantilla)

Cada archivo de preset debe seguir este patrón:

```python
"""
PRESET: Nombre de la Estructura
Descripción breve.

Descripción detallada:
- Elemento 1
- Elemento 2
"""

from engine import Engine3D


def construir_nombre_estructura(engine=None):
    """
    Construye la estructura nombre.
    
    Args:
        engine (Engine3D): Instancia del motor. Si es None, crea una nueva.
    
    Returns:
        Engine3D: Motor con la estructura construida.
    """
    if engine is None:
        engine = Engine3D()
        engine.set_modo_rapido(True)
    
    # Configuración
    engine.set_tamanos_palo_default(corto=1.5, largo=3.0)
    engine.set_constructores_proyecto(minimo=2, maximo=5)
    
    # Colores
    madera = (139, 69, 19)
    soga = (210, 180, 140)
    
    # PASO 1
    engine.registrar_rotacion_paso(1, 45, eje="x")
    # ... agregar elementos ...
    engine.registrar_comentario_paso(1, "Descripción del paso 1")
    engine.registrar_amarre_paso(1, "Tipo", constructores_min=2, constructores_max=4)
    
    # PASO 2, 3, etc...
    
    return engine
```

---

## 🔧 Troubleshooting

### Error: "Import presets could not be resolved"

**Solución**: Este es un error del IDE. El código funciona correctamente en runtime. Ejecuta desde la línea de comandos:
```bash
python run_preset.py lista  # Verifica instalación
```

### Error: "engine module not found"

**Solución**: Asegúrate de estar en la carpeta raíz del proyecto:
```bash
cd "Planos Scout"
python run_preset.py mangrullo
```

### La visualización 3D no aparece

**Solución**: Necesitas tener matplotlib y OpenGL instalados:
```bash
pip install matplotlib numpy scipy
```

---

## 💡 Tips y Trucos

### Crear una variación de un preset

```python
# En un fichero nuevo: presets/estrella_pequeña.py
from presets.estrella import construir_estrella

def construir_estrella_pequeña(engine=None):
    """Estrella scout reducida 50%."""
    engine = construir_estrella(engine)
    # Aquí podrías hacer modificaciones especiales
    return engine
```

### Combinar múltiples presets

```python
from presets import construir_mangrullo, construir_estrella
from engine import Engine3D

engine = Engine3D()
engine = construir_mangrullo(engine)

# Desplazar y agregar otra estructura
# (requeriría modificación de engine.py para traducir todas las coordenadas)
```

### Exportar solo ciertos formatos

```python
from presets import PRESETS

engine = PRESETS['estrella']['funcion']()

# Solo JSON
engine.exportar_proyecto_json("my_project.json")

# Solo PDF
engine.exportar_manual_pdf("my_manual.pdf", titulo="Mi Manual")

# Solo GIF
engine.exportar_gif_rotacion_horizontal("animation.gif", segundos=10)
```

---

## 📚 Documentación Adicional

- `presets/README.md` - Guía detallada del sistema de presets
- `engine.py` - Documentación del motor 3D
- `GEMINI_GEM_TEMPLATE.md` - Instrucciones para Gemini (generación con IA)

---

## 🎓 Próximas Mejoras Planificadas

- [ ] Parámetros configurables por preset (altura, ancho, ángulos)
- [ ] Editor visual de presets en navegador
- [ ] Importación de presets desde archivos JSON
- [ ] Generación automática de presets con Gemini
- [ ] Exportación a formatos 3D (STL, glTF) para impresoras 3D
- [ ] Animación de construcción paso a paso
- [ ] Comparador visual entre múltiples presets
- [ ] Cálculo automático de materiales (cantidad de palos, sogas, etc.)

---

## ❓ Preguntas Frecuentes

**P: ¿Puedo usar presets fuera del archivo main.py?**  
R: Sí, importa directamente desde `presets`:
```python
from presets import construir_estrella
engine = construir_estrella()
```

**P: ¿Cómo creo una variación de un preset existente?**  
R: Crea un nuevo archivo en `presets/` y llama a la función del preset base, luego modifica.

**P: ¿Se pueden mezclar dos estructuras?**  
R: Técnicamente sí, pero necesitarías desplazar las coordenadas. Es mejor crear un nuevo preset que combine ambas.

**P: ¿Qué pasa con `main.py` original?**  
R: Sigue funcionando igual, ahora es la implementación del preset `mangrullo`.

---

**Última actualización**: Marzo 2026  
**Versión**: 1.0
