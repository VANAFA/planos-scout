"""
PRESET: Torre Simple
Estructura básica de una sola columna cuadrada de 4 palos verticales.

Descripción:
- 4 palos verticales formando las esquinas de un cuadrado
- Plataformas horizontales en múltiples niveles
- Escaleras diagonales para conexión vertical
- Estructura modular y fácil de reproducir
"""

from engine import Engine3D


def construir_torre_simple(engine=None):
    """
    Construye una estructura simple de torre.
    
    Args:
        engine (Engine3D): Instancia del motor. Si es None, crea una nueva.
    
    Returns:
        Engine3D: Motor con la estructura construida.
    """
    if engine is None:
        engine = Engine3D()
        engine.set_modo_rapido(True)

    engine.set_tamanos_palo_default(corto=1.2, largo=2.5)
    engine.set_constructores_proyecto(minimo=4, maximo=8)

    # Definir el espacio de trabajo
    engine.definir_espacio(
        cantidad_x=3,
        cantidad_y=3,
        cantidad_z=4,
        ancho=4,
        largo=4,
        alto=5
    )

    # Colores
    madera = (139, 69, 19)
    soga = (210, 180, 140)
    refuerzo = (100, 100, 100)

    # PASO: 1 - ESTRUCTURA BASE (4 palos verticales)
    
    # Palos verticales de las 4 esquinas (altura = 5.0m)
    v1 = engine.palo((0, 0, 0), (0, 0, 5.0), madera, etiqueta="Vertical-NO")
    v2 = engine.palo((2, 0, 0), (2, 0, 5.0), madera, etiqueta="Vertical-NE")
    v3 = engine.palo((2, 2, 0), (2, 2, 5.0), madera, etiqueta="Vertical-SE")
    v4 = engine.palo((0, 2, 0), (0, 2, 5.0), madera, etiqueta="Vertical-SO")

    engine.registrar_comentario_paso(1, "Armar los 4 palos verticales en las esquinas. Deben estar perfectamente verticales.")
    engine.registrar_amarre_paso(1, "Base", constructores_min=4, constructores_max=6)

    # PASO: 2 - PRIMERA PLATAFORMA (z=2.0)
    
    # Palos horizontales nivel 2.0
    h1_2 = engine.palo((0, 0, 2.0), (2, 0, 2.0), madera, etiqueta="Horz-N-L2")
    h2_2 = engine.palo((2, 0, 2.0), (2, 2, 2.0), madera, etiqueta="Horz-E-L2")
    h3_2 = engine.palo((2, 2, 2.0), (0, 2, 2.0), madera, etiqueta="Horz-S-L2")
    h4_2 = engine.palo((0, 2, 2.0), (0, 0, 2.0), madera, etiqueta="Horz-O-L2")

    engine.registrar_interseccion(
        [v1, v2, v3, v4],
        [h1_2, h2_2, h3_2, h4_2],
        indices_b=[0, 1, 2, 3],
        lados=["norte", "este", "sur", "oeste"],
        desfase=0.05,
        amarre_tipo="Cuadrado",
        paso=2,
        constructores_min=2,
        constructores_max=4,
    )

    # Refuerzo diagonal en nivel 2
    refuerzo_diag_1 = engine.palo((0, 0, 2.0), (2, 2, 2.0), refuerzo, etiqueta="Refuerzo-Diag-1")
    refuerzo_diag_2 = engine.palo((2, 0, 2.0), (0, 2, 2.0), refuerzo, etiqueta="Refuerzo-Diag-2")

    engine.registrar_comentario_paso(2, "Armar la primera plataforma a 2.0m de altura. Agregar refuerzos diagonales.")
    engine.registrar_amarre_paso(2, "Diagonal", constructores_min=2, constructores_max=3)

    # PASO: 3 - SEGUNDA PLATAFORMA (z=3.5)
    
    # Palos horizontales nivel 3.5
    h1_3 = engine.palo((0, 0, 3.5), (2, 0, 3.5), madera, etiqueta="Horz-N-L3")
    h2_3 = engine.palo((2, 0, 3.5), (2, 2, 3.5), madera, etiqueta="Horz-E-L3")
    h3_3 = engine.palo((2, 2, 3.5), (0, 2, 3.5), madera, etiqueta="Horz-S-L3")
    h4_3 = engine.palo((0, 2, 3.5), (0, 0, 3.5), madera, etiqueta="Horz-O-L3")

    engine.registrar_interseccion(
        [v1, v2, v3, v4],
        [h1_3, h2_3, h3_3, h4_3],
        indices_b=[0, 1, 2, 3],
        lados=["norte", "este", "sur", "oeste"],
        desfase=0.05,
        amarre_tipo="Cuadrado",
        paso=3,
        constructores_min=2,
        constructores_max=4,
    )

    engine.registrar_comentario_paso(3, "Armar la segunda plataforma a 3.5m de altura.")
    engine.registrar_amarre_paso(3, "Cuadrado", constructores_min=2, constructores_max=3)

    # PASO: 4 - ESTABILIZACIÓN CON SOGAS
    
    # Sogas de guía diagonal
    soga1 = engine.soga((0, 0, 5.0), (2, 2, 0.5), soga, etiqueta="Soga-Diagonal-1")
    soga2 = engine.soga((2, 0, 5.0), (0, 2, 0.5), soga, etiqueta="Soga-Diagonal-2")

    engine.registrar_comentario_paso(4, "Instalar sogas de guía cruzadas desde el ápice para estabilizar la estructura.")
    engine.registrar_amarre_paso(4, "Soga", constructores_min=1, constructores_max=2)

    # Registros finales
    engine.registrar_rotacion_paso(1, 0, eje="z")

    return engine
