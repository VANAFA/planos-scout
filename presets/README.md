# Sistema de Estructuras Predefinidas (Presets)

Colección de estructuras scout prehechas para visualización y análisis rápido en engine.py.

## 🏗️ Estructuras Disponibles

### 1. **Mangrullo** (`mangrullo.py`)
- **Nombre**: Mangrullo (Estructura por defecto)
- **Descripción**: Torre con estructuras cuadradas conectadas por puente
- **Características**:
  - Dos estructuras cuadradas de 4 palos verticales cada una
  - Niveles horizontales en múltiples alturas
  - Puente diagonal que conecta los dos módulos
  - Sogas guía y caña central para estabilidad
  - Vista isométrica por defecto
- **Constructor**: `construir_mangrullo(engine)`

### 2. **Estrella Scout** (`estrella.py`)
- **Nombre**: Estrella Scout (Hexagrama)
- **Descripción**: Base elevada con trípodes y dos triángulos equiláteros superpuestos
- **Características**:
  - 3 trípodes de 20m anclados en vértices de un triángulo base
  - Triángulo A: vértice hacia arriba (10.0m altura)
  - Triángulo B: invertido para formar estrella de 6 puntas
  - Configuración de ángulo inicial con `angulo_inicial=90`
  - Vista isométrica a 45° elevación
- **Constructor**: `construir_estrella(engine)`

### 3. **Torre Simple** (`torre_simple.py`)
- **Nombre**: Torre Simple
- **Descripción**: Torre de una sola columna cuadrada de 4 palos verticales
- **Características**:
  - 4 palos verticales formando esquinas de un cuadrado
  - Plataformas horizontales en 2 niveles (2.0m y 3.5m)
  - Escaleras diagonales para refuerzo
  - Sogas de guía cruzadas desde el ápice
  - Estructura modular y reproducible
- **Constructor**: `construir_torre_simple(engine)`

## 📖 Cómo Usar

### Opción 1: Desde `main_selector.py` (RECOMENDADO)

```bash
# Ejecutar el selector automático
python main_selector.py
```

Luego modifica el valor de `PRESET_SELECCIONADO` en `main_selector.py`:

```python
PRESET_SELECCIONADO = 'mangrullo'  # Cambia a 'estrella' o 'torre_simple'
```

### Opción 2: Importar directamente en tu código

```python
from presets import construir_mangrullo, construir_estrella, construir_torre_simple
from engine import Engine3D

# Opción A: Crear estructura sin engine previo
engine = construir_mangrullo()

# Opción B: Agregar a un engine existente
engine = Engine3D()
engine = construir_estrella(engine)

# Visualizar
engine.show(mostrar_intersecciones=True)
```

### Opción 3: Listar presets disponibles

```python
from presets import listar_presets, PRESETS

# Ver lista de presets
listar_presets()

# Acceder por código
for clave, info in PRESETS.items():
    print(f"[{clave}] {info['nombre']}")
    # Usar el preset...
    estructura = info['funcion']()
```

## 🔧 Estructura de Archivos

```
presets/
├── __init__.py              # Gestor de presets (importaciones y registro)
├── mangrullo.py             # Estructura de mangrullo
├── estrella.py              # Estructura de estrella scout
├── torre_simple.py          # Estructura de torre simple
└── README.md                # Este archivo
```

## ➕ Cómo Agregar un Nuevo Preset

1. **Crear nuevo archivo** en la carpeta `presets/`:
   ```bash
   touch presets/nueva_estructura.py
   ```

2. **Implementar la función**:
   ```python
   from engine import Engine3D

   def construir_nueva_estructura(engine=None):
       """
       Construye la nueva estructura.
       
       Args:
           engine (Engine3D): Instancia del motor. Si es None, crea una nueva.
       
       Returns:
           Engine3D: Motor con la estructura construida.
       """
       if engine is None:
           engine = Engine3D()
           engine.set_modo_rapido(True)
       
       # Tu código aquí...
       # engine.palo(...)
       # engine.tripode(...)
       # etc.
       
       return engine
   ```

3. **Registrar en `__init__.py`**:
   ```python
   from .nueva_estructura import construir_nueva_estructura
   
   PRESETS = {
       # ... presets existentes ...
       'nueva_estructura': {
           'nombre': 'Nombre Descriptivo',
           'descripcion': 'Breve descripción',
           'funcion': construir_nueva_estructura,
       },
   }
   ```

4. **Usar desde `main_selector.py`**:
   ```python
   PRESET_SELECCIONADO = 'nueva_estructura'
   python main_selector.py
   ```

## 📋 Checklist para Nuevos Presets

- [ ] Archivo creado en `presets/nombre.py`
- [ ] Función `construir_nombre(engine=None)` implementada
- [ ] Docstring con descripción y uso
- [ ] Registrado en `presets/__init__.py`
- [ ] Probado con `main_selector.py`
- [ ] Exporta JSON, PDF y GIF automáticamente
- [ ] Comentarios paso a paso registrados
- [ ] Amarres y rotaciones defini

## 🎨 Colores Comunes

```python
madera = (139, 69, 19)      # Marrón
soga = (210, 180, 140)      # Beige/tela
refuerzo = (100, 100, 100)  # Gris
rojo = (255, 0, 0)
verde = (0, 255, 0)
amarillo = (255, 255, 0)
azul = (0, 0, 255)
```

## 📝 Notas

- Todos los presets automáticamente:
  - Generan resumen de montaje
  - Exportan a `proyecto_scout.json`
  - Generan manual PDF
  - Crean GIF de rotación 360°
  
- Los constructores usan `engine.set_constructores_proyecto()` para definir rango
- Las rotaciones se registran por paso para diferentes vistas
- Los amarres tienen tipos ("Cuadrado", "Diagonal", etc.) y especifican min/máx constructores

## 🚀 Próximas Mejoras

- [ ] Parámetros configurables por preset (altura, ancho, etc.)
- [ ] Editor visual de presets
- [ ] Exportación a formatos 3D (STL, gLTF)
- [ ] Generador de presets por IA
- [ ] Variaciones de presets (pequeño/mediano/grande)
