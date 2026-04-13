"""
PRESET: Estrella Scout (Hexagrama)
Base elevada estrella con soporte de trípodes y dos triángulos equiláteros superpuestos.

Descripción:
- 3 trípodes de 20m anclados en vértices de un triángulo base
- Triángulo A: vértice hacia arriba (conecta ápices de trípodes)
- Triángulo B: invertido para formar estrella de 6 puntas (hexagrama)
- Vista isométrica por defecto a 45° elevación
"""

from engine import Engine3D


def construir_estrella(engine=None):
    """
    Construye la estructura de estrella scout.
    
    Args:
        engine (Engine3D): Instancia del motor. Si es None, crea una nueva.
    
    Returns:
        Engine3D: Motor con la estructura construida.
    """
    if engine is None:
        engine = Engine3D()
        engine.set_modo_rapido(True)

    # Configuración base
    # (Usa literales numéricos para evitar errores del parser)
    # Color madera: (139, 69, 19)
    # Altura de la estrella: 10.0m
    # Radio de la estrella: 20.0m

    # PASO: 1 - Instalación de los 3 Trípodes de Soporte
    engine.registrar_rotacion_paso(1, 45, eje="x")
    engine.registrar_rotacion_paso(1, 45, eje="z")
    
    # Trípode 1 (Norte - Vértice Superior)
    engine.tripode((0.0, 14.0, 0.0), 20.0, 10.0, (139, 69, 19), angulo_inicial=90)
    # Trípode 2 (Suroeste)
    engine.tripode((-11.5, -6.5, 0.0), 20.0, 10, (139, 69, 19), angulo_inicial=90)
    # Trípode 3 (Sureste)
    engine.tripode((11.5, -6.5, 0.0), 20.0, 10.0, (139, 69, 19), angulo_inicial=90)

    engine.registrar_comentario_paso(1, "Levantar tres trípodes de 10m de altura en los puntos de apoyo del primer triángulo.")
    engine.registrar_amarre_paso(1, "Tripode", constructores_min=6, constructores_max=9)

    # PASO: 2 - Construcción del Triángulo A (Vértice hacia arriba)
    # Se conecta la parte superior de los trípodes para formar la base de la estrella.
    engine.palo((0.0, 20.0, 10.0), (-17.32, -10.0, 10.0), (139, 69, 19), etiqueta="Tri_A_L1")
    engine.palo((-17.32, -10.0, 10.0), (17.32, -10.0, 10.0), (139, 69, 19), etiqueta="Tri_A_L2")
    engine.palo((17.32, -10.0, 10.0), (0.0, 20.0, 10.0), (139, 69, 19), etiqueta="Tri_A_L3")
    
    engine.registrar_comentario_paso(2, "Armar el primer triángulo equilátero sobre los ápices de los trípodes.")
    engine.registrar_amarre_paso(2, "Cuadrado", constructores_min=3, constructores_max=6)

    # PASO: 3 - Construcción del Triángulo B (Invertido - Vértice hacia abajo)
    # Se superpone para formar la estrella de 6 puntas. 
    # Elevación 10.3m para evitar solapamiento visual.
    engine.palo((0.0, -20.0, 10.3), (17.32, 10.0, 10.3), (139, 69, 19), etiqueta="Tri_B_L1")
    engine.palo((17.32, 10.0, 10.3), (-17.32, 10.0, 10.3), (139, 69, 19), etiqueta="Tri_B_L2")
    engine.palo((-17.32, 10.0, 10.3), (0.0, -20.0, 10.3), (139, 69, 19), etiqueta="Tri_B_L3")
    
    engine.registrar_comentario_paso(3, "Superponer el segundo triángulo equilátero invertido completando el hexagrama.")
    engine.registrar_amarre_paso(3, "Cuadrado", constructores_min=3, constructores_max=6)

    # PASO: 4 - Consolidación de Amarres y Vista Superior (TOP VIEW)
    # Rotación a 90 grados en X para coincidir con perspectiva del dibujo original.
    engine.registrar_rotacion_paso(4, 90, eje="x")
    engine.registrar_rotacion_paso(4, 0, eje="z")
    
    engine.registrar_comentario_paso(4, "Asegurar los cruces de los palos con amarres diagonales para estabilizar la estrella.")
    engine.registrar_amarre_paso(4, "Diagonal", constructores_min=2, constructores_max=4)

    return engine
