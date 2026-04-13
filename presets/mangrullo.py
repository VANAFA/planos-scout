"""
PRESET: Mangrullo (Estructura por defecto)
Torre con estructuras cuadradas conectadas por puente.

Descripción:
- Dos estructuras cuadradas de 4 palos verticales cada una
- Niveles horizontales conectado entre ambas estructuras
- Puente diagonal que conecta los dos módulos
- Sogas guía y caña central para estabilidad
"""

from engine import Engine3D
import numpy as np


def construir_mangrullo(engine=None):
    """
    Construye la estructura de mangrullo por defecto.
    
    Args:
        engine (Engine3D): Instancia del motor. Si es None, crea una nueva.
    
    Returns:
        Engine3D: Motor con la estructura construida.
    """
    if engine is None:
        engine = Engine3D()
        engine.set_modo_rapido(True)
    
    engine.set_tamanos_palo_default(corto=1.5, largo=3.0)
    engine.set_constructores_proyecto(minimo=2, maximo=5)

    engine.definir_espacio(
        cantidad_x=5,
        cantidad_y=3,
        cantidad_z=4,
        ancho=5,
        largo=5,
        alto=5
    )

    rojo = (255, 0, 0)
    verde = (0, 255, 0)
    amarillo = (255, 255, 0)
    azul = (0, 0, 255)

    def cuatro_palos_vertical(x, y, z_max, color=rojo):
        """Construye 4 palos verticales formando las esquinas de un cuadrado."""
        ids = []
        ids.append(engine.palo((x, y, 0), (x, y, z_max), color, etiqueta=f"V({x},{y})"))
        ids.append(engine.palo((x+1, y, 0), (x+1, y, z_max), color, etiqueta=f"V({x+1},{y})"))
        ids.append(engine.palo((x, y+1, 0), (x, y+1, z_max), color, etiqueta=f"V({x},{y+1})"))
        ids.append(engine.palo((x+1, y+1, 0), (x+1, y+1, z_max), color, etiqueta=f"V({x+1},{y+1})"))
        return ids

    def cuadrado_acostado(x, y, z, color=rojo):
        """Construye 4 palos horizontales formando un cuadrado en un nivel Z."""
        ids = []
        ids.append(engine.palo((x, y, z), (x+1, y, z), color, etiqueta=f"H1@z{z}"))
        ids.append(engine.palo((x+1, y, z), (x+1, y+1, z), color, etiqueta=f"H2@z{z}"))
        ids.append(engine.palo((x+1, y+1, z), (x, y+1, z), color, etiqueta=f"H3@z{z}"))
        ids.append(engine.palo((x, y+1, z), (x, y, z), color, etiqueta=f"H4@z{z}"))
        return ids

    def escalera(cantidad_escalones, palo1_init, palo1_end, palo2_init, palo2_end, color=azul):
        """Dibuja escalones conectores entre dos palos."""
        palo1_init = np.array(palo1_init, dtype=float)
        palo1_end = np.array(palo1_end, dtype=float)
        palo2_init = np.array(palo2_init, dtype=float)
        palo2_end = np.array(palo2_end, dtype=float)

        for i in range(1, cantidad_escalones + 1):
            t = i / (cantidad_escalones + 1)
            punto1 = palo1_init + t * (palo1_end - palo1_init)
            punto2 = palo2_init + t * (palo2_end - palo2_init)
            engine.palo(punto1, punto2, color)

    # ===== PASO 1: ESTRUCTURAS CUADRADAS BASE =====
    
    # Estructura cuadrada 1
    base1_verticales = cuatro_palos_vertical(0, 0, 3)
    base1_techo = cuadrado_acostado(0, 0, 2)
    engine.registrar_interseccion(
        base1_verticales,
        base1_techo,
        indices_b=[0, 1, 3, 2],
        lados=["norte", "este", "oeste", "sur"],
        desfase=.08,
        amarre_tipo="Cuadrado",
        paso=1,
        constructores_min=2,
        constructores_max=3,
    )

    cuadrado_acostado(0, 0, 1)

    # Estructura cuadrada 2
    base2_verticales = cuatro_palos_vertical(3, 0, 3)
    base2_techo = cuadrado_acostado(3, 0, 2)
    engine.registrar_interseccion(
        base2_verticales,
        base2_techo,
        indices_b=[0, 1, 3, 2],
        lados=["norte", "este", "oeste", "sur"],
        desfase=.08,
        amarre_tipo="Cuadrado",
        paso=1,
        constructores_min=2,
        constructores_max=3,
    )
    cuadrado_acostado(3, 0, 1)

    # ===== PASO 2: CONEXIONES Y PUENTE =====
    
    # Escalera diagonal
    diag1 = engine.palo((-1, 0, 0), (0, 0, 1), azul, etiqueta="Diag-1")
    diag2 = engine.palo((-1, 1, 0), (0, 1, 1), azul, etiqueta="Diag-2")

    escalera(3, (-1, 0, 0), (0, 0, 1), (-1, 1, 0), (0, 1, 1))

    # Escalera vertical
    escalera(3, (1, 0, 2), (1, 0, 1), (1, 1, 2), (1, 1, 1))

    # Palos conectores del puente
    puente_norte = engine.palo((1, 0, 2), (3, 0, 2), verde, etiqueta="Puente-N")
    puente_sur = engine.palo((1, 1, 2), (3, 1, 2), verde, etiqueta="Puente-S")
    escalera(3, (1, 0, 2), (1, 1, 2), (3, 0, 2), (3, 1, 2), amarillo)

    # ===== PASO 3: ELEMENTOS DE ESTABILIDAD =====
    
    soga_superior = engine.soga((0, -0.4, 2.2), (4, -0.4, 2.2), (200, 150, 90), etiqueta="Soga-Guia")
    cana_central = engine.cana((2.5, 0.5, 0), (2.5, 0.5, 3.5), (230, 210, 140), etiqueta="Caña-Central")

    # ===== REGISTROS Y METADATOS =====
    
    engine.registrar_comentario_paso(1, "Construir las dos estructuras cuadradas base. Asegurar que todos los nudos estén bien apretados.")
    engine.registrar_comentario_paso(2, "Conectar las dos estructuras con el puente. Verificar que sea nivel y resistente.")
    engine.registrar_comentario_paso(3, "Amarrar la caña central y la soga guía. Estos elementos son de soporte crítico.")

    # Rotación por paso
    engine.registrar_rotacion_paso(2, 180, eje="z")

    return engine
