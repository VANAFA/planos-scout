import numpy as np
import matplotlib.pyplot as plt
from matplotlib.lines import Line2D
from matplotlib.backends.backend_pdf import PdfPages
from matplotlib.animation import FuncAnimation, PillowWriter
import json


class Engine3D:
    def __init__(self):
        self._grid_points = None
        self._palos = []
        self._intersecciones = []
        self._next_elemento_id = 1
        self._space_size = (1.0, 1.0, 1.0)
        self._grid_count = (2, 2, 2)
        self.grosor_palo = 0.05
        self.grosor_soga = 0.02
        self.grosor_cana = 0.035
        self.grosor_tabla_min = 0.04
        self.modo_rapido = False
        self.resolucion_cilindro_theta = 12
        self.resolucion_cilindro_largo = 4
        self.cilindro_antialias = False
        self.cilindro_shade = False
        self.extension_palo = 0.2
        self.tamano_palo_corto = 1.5
        self.tamano_palo_largo = 3.0
        self.constructores_min_proyecto = None
        self.constructores_max_proyecto = None
        self.centrar_en_centroide = True
        self._centroide = None
        self.mostrar_rosa_vientos = True
        self.mostrar_plano_suelo = True
        self.color_plano_suelo = "#43a047"
        self.alpha_plano_suelo = 0.32
        self._comentarios_paso = {}
        self._rotaciones_paso = {}
        self._amarres_paso = {}
        self.colores_nudo = {
            "cuadrado": "#d81b60",
            "diagonal": "#1e88e5",
            "ballestrinque": "#43a047",
            "vuelta_de_braza": "#f4511e",
            "sin_definir": "#8e24aa",
        }

    def definir_espacio(
        self,
        cantidad_x,
        cantidad_y,
        cantidad_z,
        ancho,
        largo,
        alto,
    ):
        if min(cantidad_x, cantidad_y, cantidad_z) < 2:
            raise ValueError("Cada dimensión de cantidad debe ser >= 2")

        self._grid_count = (int(cantidad_x), int(cantidad_y), int(cantidad_z))
        self._space_size = (float(ancho), float(largo), float(alto))

        xs = np.linspace(0.0, ancho, cantidad_x)
        ys = np.linspace(0.0, largo, cantidad_y)
        zs = np.linspace(0.0, alto, cantidad_z)

        xv, yv, zv = np.meshgrid(xs, ys, zs, indexing="ij")
        self._grid_points = np.column_stack((xv.ravel(), yv.ravel(), zv.ravel()))

    def elemento(self, punto1, punto2, color, tipo="palo", fixed=False, etiqueta=None, tamano=None, largo=None, ancho=None):
        p1 = np.array(punto1, dtype=float)
        p2 = np.array(punto2, dtype=float)
        rgb = np.array(color, dtype=float)

        if p1.shape != (3,) or p2.shape != (3,):
            raise ValueError("punto1 y punto2 deben ser vectores de 3 valores")
        if rgb.shape != (3,):
            raise ValueError("color debe ser un vector RGB de 3 valores")

        if np.any(rgb < 0) or np.any(rgb > 255):
            raise ValueError("Los valores RGB deben estar entre 0 y 255")
        if tipo not in {"palo", "soga", "cana", "tabla"}:
            raise ValueError("tipo debe ser 'palo', 'soga', 'cana' o 'tabla'")

        elemento_id = self._next_elemento_id
        self._next_elemento_id += 1

        self._palos.append(
            {
                "id": elemento_id,
                "p1": p1,
                "p2": p2,
                "color": rgb / 255.0,
                "tipo": tipo,
                "fixed": bool(fixed),
                "etiqueta": etiqueta,
                "tamano": tamano,
                "largo": float(largo) if largo is not None else None,
                "ancho": float(ancho) if ancho is not None else None,
            }
        )
        return elemento_id

    def palo(self, punto1, punto2, color, fixed=False, etiqueta=None, tamano=None):
        return self.elemento(punto1, punto2, color, tipo="palo", fixed=fixed, etiqueta=etiqueta, tamano=tamano)

    def soga(self, punto1, punto2, color=(180, 140, 80), fixed=False, etiqueta=None):
        return self.elemento(punto1, punto2, color, tipo="soga", fixed=fixed, etiqueta=etiqueta)

    def cana(self, punto1, punto2, color=(210, 185, 120), fixed=False, etiqueta=None):
        return self.elemento(punto1, punto2, color, tipo="cana", fixed=fixed, etiqueta=etiqueta)

    def tabla(
        self,
        punto_inicio,
        direccion,
        color=(160, 120, 80),
        largo=None,
        ancho=None,
        fixed=False,
        etiqueta=None,
    ):
        inicio = np.array(punto_inicio, dtype=float)
        vector = np.array(direccion, dtype=float)

        if inicio.shape != (3,) or vector.shape != (3,):
            raise ValueError("punto_inicio y direccion deben ser vectores de 3 valores")

        norma = np.linalg.norm(vector)
        if norma == 0:
            raise ValueError("direccion no puede ser vector cero")

        if largo is None:
            largo = float(self.tamano_palo_corto)
        else:
            largo = float(largo)
        if largo <= 0:
            raise ValueError("largo de tabla debe ser > 0")

        if ancho is None:
            ancho = float(largo / 5.0)
        else:
            ancho = float(ancho)
        if ancho <= 0:
            raise ValueError("ancho de tabla debe ser > 0")

        fin = inicio + (vector / norma) * largo
        return self.elemento(
            inicio,
            fin,
            color,
            tipo="tabla",
            fixed=fixed,
            etiqueta=etiqueta,
            tamano="tabla",
            largo=largo,
            ancho=ancho,
        )

    def tripode(self, centro, altura, radio_base, color=(255, 0, 0), etiqueta_prefix="Tripode", fixed=False, angulo_inicial=0):
        c = np.array(centro, dtype=float)
        if c.shape != (3,):
            raise ValueError("centro debe ser un vector de 3 valores: (x, y, z_base)")

        altura = float(altura)
        radio_base = float(radio_base)
        if altura <= 0 or radio_base <= 0:
            raise ValueError("altura y radio_base deben ser > 0")

        apex = np.array([c[0], c[1], c[2] + altura], dtype=float)
        angulo_inicial_rad = (float(angulo_inicial) * np.pi) / 180.0
        angulos = [
            angulo_inicial_rad,
            angulo_inicial_rad + 2.0 * np.pi / 3.0,
            angulo_inicial_rad + 4.0 * np.pi / 3.0
        ]
        ids = []

        for idx, ang in enumerate(angulos, start=1):
            base = np.array([
                c[0] + radio_base * np.cos(ang),
                c[1] + radio_base * np.sin(ang),
                c[2],
            ], dtype=float)
            ids.append(
                self.palo(
                    apex,
                    base,
                    color,
                    fixed=fixed,
                    etiqueta=f"{etiqueta_prefix}-Pata-{idx}",
                )
            )
        return ids

    def cuapode(self, centro, altura, radio_base, color=(255, 0, 0), etiqueta_prefix="Cuapode", fixed=False, angulo_inicial=0):
        c = np.array(centro, dtype=float)
        if c.shape != (3,):
            raise ValueError("centro debe ser un vector de 3 valores: (x, y, z_base)")

        altura = float(altura)
        radio_base = float(radio_base)
        if altura <= 0 or radio_base <= 0:
            raise ValueError("altura y radio_base deben ser > 0")

        apex = np.array([c[0], c[1], c[2] + altura], dtype=float)
        angulo_inicial_rad = (float(angulo_inicial) * np.pi) / 180.0
        
        # Cuatro ángulos distribuidos: 45°, 135°, 225°, 315° (offset por angulo_inicial)
        angulos = [
            angulo_inicial_rad + np.pi / 4.0,
            angulo_inicial_rad + 3.0 * np.pi / 4.0,
            angulo_inicial_rad + 5.0 * np.pi / 4.0,
            angulo_inicial_rad + 7.0 * np.pi / 4.0,
        ]
        
        ids = []
        for idx, ang in enumerate(angulos, start=1):
            base = np.array([
                c[0] + radio_base * np.cos(ang),
                c[1] + radio_base * np.sin(ang),
                c[2],
            ], dtype=float)
            ids.append(
                self.palo(
                    apex,
                    base,
                    color,
                    fixed=fixed,
                    etiqueta=f"{etiqueta_prefix}-Pata-{idx}",
                )
            )
        return ids

    def set_tamanos_palo_default(self, corto, largo):
        corto = float(corto)
        largo = float(largo)
        if corto <= 0 or largo <= 0:
            raise ValueError("Los tamaños por defecto deben ser > 0")
        if corto >= largo:
            raise ValueError("'corto' debe ser menor que 'largo'")
        self.tamano_palo_corto = corto
        self.tamano_palo_largo = largo

    def agregar_palo_default(self, punto_inicio, direccion, tamano="largo", color=(255, 0, 0), fixed=False, etiqueta=None):
        inicio = np.array(punto_inicio, dtype=float)
        vector = np.array(direccion, dtype=float)
        if inicio.shape != (3,) or vector.shape != (3,):
            raise ValueError("punto_inicio y direccion deben ser vectores de 3 valores")

        norma = np.linalg.norm(vector)
        if norma == 0:
            raise ValueError("direccion no puede ser vector cero")

        if tamano == "corto":
            largo = self.tamano_palo_corto
        elif tamano == "largo":
            largo = self.tamano_palo_largo
        else:
            raise ValueError("tamano debe ser 'corto' o 'largo'")

        fin = inicio + (vector / norma) * largo
        return self.palo(inicio, fin, color, fixed=fixed, etiqueta=etiqueta, tamano=tamano)

    def set_constructores_proyecto(self, minimo=None, maximo=None):
        if minimo is not None:
            minimo = int(minimo)
            if minimo < 1:
                raise ValueError("constructores minimo debe ser >= 1")
        if maximo is not None:
            maximo = int(maximo)
            if maximo < 1:
                raise ValueError("constructores maximo debe ser >= 1")
        if minimo is not None and maximo is not None and minimo > maximo:
            raise ValueError("constructores minimo no puede ser mayor que maximo")

        self.constructores_min_proyecto = minimo
        self.constructores_max_proyecto = maximo

    def _buscar_elemento(self, elemento_id):
        for elemento in self._palos:
            if elemento["id"] == elemento_id:
                return elemento
        return None

    def registrar_interseccion(
        self,
        elemento_a_id,
        elemento_b_id,
        lado="norte",
        desfase=0.0,
        amarre_tipo="sin_definir",
        paso=None,
        constructores_min=None,
        constructores_max=None,
        lados=None,
        indices_b=None,
    ):
        def _normalizar_ids(valor):
            if isinstance(valor, (list, tuple, np.ndarray)):
                if len(valor) == 0:
                    raise ValueError("No se puede registrar una intersección con un grupo vacío")
                return [int(v) for v in valor]
            return [int(valor)]

        ids_a = _normalizar_ids(elemento_a_id)
        ids_b = _normalizar_ids(elemento_b_id)

        for aid in ids_a:
            if self._buscar_elemento(aid) is None:
                raise ValueError(f"No existe elemento con id={aid}")
        for bid in ids_b:
            if self._buscar_elemento(bid) is None:
                raise ValueError(f"No existe elemento con id={bid}")

        lados_validos = {"norte", "sur", "este", "oeste", "arriba", "abajo"}
        if isinstance(lado, str):
            if lado not in lados_validos:
                raise ValueError("lado debe ser: norte, sur, este, oeste, arriba o abajo")
        
        if lados is not None:
            if not isinstance(lados, (list, tuple)):
                raise ValueError("lados debe ser una lista cuando se usan grupos")
            lados = [str(l) for l in lados]
            for l in lados:
                if l not in lados_validos:
                    raise ValueError(f"lado inválido: {l}")

        desfase = float(desfase)
        if desfase < 0:
            raise ValueError("desfase debe ser >= 0")

        if constructores_min is not None:
            constructores_min = int(constructores_min)
            if constructores_min < 1:
                raise ValueError("constructores_min debe ser >= 1")
        if constructores_max is not None:
            constructores_max = int(constructores_max)
            if constructores_max < 1:
                raise ValueError("constructores_max debe ser >= 1")
        if constructores_min is not None and constructores_max is not None and constructores_min > constructores_max:
            raise ValueError("constructores_min no puede ser mayor que constructores_max")

        if indices_b is not None:
            if not isinstance(indices_b, (list, tuple)):
                raise ValueError("indices_b debe ser una lista cuando se usan grupos")
            if len(indices_b) != len(ids_a):
                raise ValueError(f"indices_b debe tener {len(ids_a)} elementos para mapear A → B")
            pares = [(ids_a[i], ids_b[int(indices_b[i])]) for i in range(len(ids_a))]
        else:
            pares = []
            if len(ids_a) == 1 and len(ids_b) == 1:
                pares = [(ids_a[0], ids_b[0])]
            elif len(ids_a) == 1:
                pares = [(ids_a[0], bid) for bid in ids_b]
            elif len(ids_b) == 1:
                pares = [(aid, ids_b[0]) for aid in ids_a]
            elif len(ids_a) == len(ids_b):
                pares = list(zip(ids_a, ids_b))
            else:
                raise ValueError(
                    "Para intersecciones entre grupos, usa longitudes iguales (pareo por índice) "
                    "o un solo elemento contra un grupo"
                )

        if lados is not None and len(lados) != len(pares):
            raise ValueError(f"lados debe tener {len(pares)} elementos para {len(pares)} pares")

        indices_creados = []
        for idx, (aid, bid) in enumerate(pares):
            if aid == bid:
                raise ValueError("Una intersección necesita dos elementos distintos")

            lado_actual = lados[idx] if lados is not None else lado

            interseccion = {
                "elemento_a_id": int(aid),
                "elemento_b_id": int(bid),
                "lado": lado_actual,
                "desfase": desfase,
                "amarre_tipo": str(amarre_tipo),
                "paso": int(paso) if paso is not None else None,
                "constructores_min": constructores_min,
                "constructores_max": constructores_max,
            }
            self._intersecciones.append(interseccion)
            indices_creados.append(len(self._intersecciones) - 1)

        if len(indices_creados) == 1:
            return indices_creados[0]
        return indices_creados

    def get_intersecciones(self):
        return [dict(item) for item in self._intersecciones]

    def generar_resumen_montaje(self):
        resumen = {
            "total_elementos": len(self._palos),
            "por_tipo": {"palo": 0, "soga": 0, "cana": 0, "tabla": 0},
            "total_intersecciones": len(self._intersecciones),
            "pasos": {},
        }

        for elemento in self._palos:
            resumen["por_tipo"][elemento["tipo"]] += 1

        for inter in self._intersecciones:
            paso = inter["paso"] if inter["paso"] is not None else "sin_paso"
            if paso not in resumen["pasos"]:
                resumen["pasos"][paso] = {
                    "cantidad_amarres": 0,
                    "constructores_min": None,
                    "constructores_max": None,
                }

            data = resumen["pasos"][paso]
            data["cantidad_amarres"] += 1

            cmin = inter["constructores_min"]
            cmax = inter["constructores_max"]

            if cmin is not None:
                data["constructores_min"] = cmin if data["constructores_min"] is None else min(data["constructores_min"], cmin)
            if cmax is not None:
                data["constructores_max"] = cmax if data["constructores_max"] is None else max(data["constructores_max"], cmax)

        for paso_key, meta in self._amarres_paso.items():
            paso = int(paso_key) if str(paso_key).isdigit() else paso_key
            if paso not in resumen["pasos"]:
                resumen["pasos"][paso] = {
                    "cantidad_amarres": 0,
                    "constructores_min": None,
                    "constructores_max": None,
                }

            data = resumen["pasos"][paso]
            data["cantidad_amarres"] = max(data["cantidad_amarres"], len(meta.get("amarres", [])))

            cmin = meta.get("constructores_min")
            cmax = meta.get("constructores_max")

            if cmin is not None:
                data["constructores_min"] = cmin if data["constructores_min"] is None else min(data["constructores_min"], cmin)
            if cmax is not None:
                data["constructores_max"] = cmax if data["constructores_max"] is None else max(data["constructores_max"], cmax)

        return resumen

    def generar_resumen_montaje_texto(self):
        resumen = self.generar_resumen_montaje()
        lineas = []
        lineas.append("=== RESUMEN DE MONTAJE ===")
        lineas.append(f"Elementos totales: {resumen['total_elementos']}")
        lineas.append(
            f"Palos: {resumen['por_tipo']['palo']} | Cañas: {resumen['por_tipo']['cana']} | Tablas: {resumen['por_tipo']['tabla']} | Sogas: {resumen['por_tipo']['soga']}"
        )
        lineas.append(f"Intersecciones registradas: {resumen['total_intersecciones']}")

        if not resumen["pasos"]:
            lineas.append("No hay pasos de montaje definidos todavía.")
            return "\n".join(lineas)

        lineas.append("\nPasos:")
        for paso in sorted(resumen["pasos"].keys(), key=lambda x: (x == "sin_paso", x)):
            data = resumen["pasos"][paso]
            cmin = data["constructores_min"] if data["constructores_min"] is not None else "-"
            cmax = data["constructores_max"] if data["constructores_max"] is not None else "-"
            lineas.append(
                f"- Paso {paso}: amarres={data['cantidad_amarres']} | constructores(min/max)={cmin}/{cmax}"
            )

        return "\n".join(lineas)

    def _longitud_elemento(self, elemento):
        return float(np.linalg.norm(elemento["p2"] - elemento["p1"]))

    def generar_lista_materiales(self):
        materiales = {
            "resumen": {
                "palo": {"cantidad": 0, "longitud_total": 0.0, "corto": 0, "largo": 0, "personalizado": 0},
                "cana": {"cantidad": 0, "longitud_total": 0.0},
                "tabla": {"cantidad": 0, "longitud_total": 0.0, "ancho_total": 0.0},
                "soga": {"cantidad": 0, "longitud_total": 0.0},
            },
            "detalle": [],
        }

        for elemento in self._palos:
            tipo = elemento["tipo"]
            longitud = self._longitud_elemento(elemento)

            if tipo == "palo":
                materiales["resumen"]["palo"]["cantidad"] += 1
                materiales["resumen"]["palo"]["longitud_total"] += longitud

                if elemento.get("tamano") == "corto":
                    materiales["resumen"]["palo"]["corto"] += 1
                elif elemento.get("tamano") == "largo":
                    materiales["resumen"]["palo"]["largo"] += 1
                else:
                    materiales["resumen"]["palo"]["personalizado"] += 1
            elif tipo == "cana":
                materiales["resumen"]["cana"]["cantidad"] += 1
                materiales["resumen"]["cana"]["longitud_total"] += longitud
            elif tipo == "tabla":
                materiales["resumen"]["tabla"]["cantidad"] += 1
                materiales["resumen"]["tabla"]["longitud_total"] += longitud
                materiales["resumen"]["tabla"]["ancho_total"] += float(elemento.get("ancho") or 0.0)
            elif tipo == "soga":
                materiales["resumen"]["soga"]["cantidad"] += 1
                materiales["resumen"]["soga"]["longitud_total"] += longitud

            materiales["detalle"].append(
                {
                    "id": elemento["id"],
                    "tipo": tipo,
                    "etiqueta": elemento.get("etiqueta"),
                    "tamano": elemento.get("tamano"),
                    "ancho": round(float(elemento.get("ancho") or 0.0), 3) if tipo == "tabla" else None,
                    "longitud": round(longitud, 3),
                }
            )

        for tipo in ("palo", "cana", "tabla", "soga"):
            if "longitud_total" in materiales["resumen"][tipo]:
                materiales["resumen"][tipo]["longitud_total"] = round(materiales["resumen"][tipo]["longitud_total"], 3)
        materiales["resumen"]["tabla"]["ancho_total"] = round(materiales["resumen"]["tabla"]["ancho_total"], 3)

        return materiales

    def exportar_proyecto_json(self, ruta_archivo):
        data = {
            "espacio": {
                "cantidad": {
                    "x": self._grid_count[0],
                    "y": self._grid_count[1],
                    "z": self._grid_count[2],
                },
                "tamano": {
                    "ancho": self._space_size[0],
                    "largo": self._space_size[1],
                    "alto": self._space_size[2],
                },
            },
            "defaults": {
                "tamano_palo_corto": self.tamano_palo_corto,
                "tamano_palo_largo": self.tamano_palo_largo,
                "grosor_palo": self.grosor_palo,
                "grosor_cana": self.grosor_cana,
                "grosor_soga": self.grosor_soga,
                "grosor_tabla_min": self.grosor_tabla_min,
            },
            "constructores": {
                "minimo": self.constructores_min_proyecto,
                "maximo": self.constructores_max_proyecto,
            },
            "comentarios_paso": dict(self._comentarios_paso),
            "rotaciones_paso": dict(self._rotaciones_paso),
            "amarres_paso": self.get_amarres_paso(),
            "elementos": [],
            "intersecciones": self.get_intersecciones(),
            "materiales": self.generar_lista_materiales()["resumen"],
        }

        for elemento in self._palos:
            data["elementos"].append(
                {
                    "id": elemento["id"],
                    "tipo": elemento["tipo"],
                    "p1": elemento["p1"].tolist(),
                    "p2": elemento["p2"].tolist(),
                    "color_rgb_0_1": elemento["color"].tolist(),
                    "fixed": elemento.get("fixed", False),
                    "etiqueta": elemento.get("etiqueta"),
                    "tamano": elemento.get("tamano"),
                    "largo": elemento.get("largo"),
                    "ancho": elemento.get("ancho"),
                }
            )

        with open(ruta_archivo, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def _clave_orden_paso(self, paso):
        if paso == "sin_paso" or paso is None:
            return 10**9
        return int(paso)

    def _ids_por_estado_en_paso(self, paso_actual):
        paso_ord = self._clave_orden_paso(paso_actual)
        ids_previos = set()
        ids_actuales = set()

        for inter in self._intersecciones:
            inter_paso = inter["paso"] if inter["paso"] is not None else "sin_paso"
            inter_ord = self._clave_orden_paso(inter_paso)

            ids = {inter["elemento_a_id"], inter["elemento_b_id"]}
            if inter_ord < paso_ord:
                ids_previos.update(ids)
            elif inter_ord == paso_ord:
                ids_actuales.update(ids)

        ids_previos -= ids_actuales
        return ids_previos, ids_actuales

    def _draw_intersecciones_paso_manual(self, ax, offset, paso_actual):
        puntos_prev = []
        puntos_actual = []
        colores_actual = []

        for inter in self._intersecciones:
            inter_paso = inter["paso"] if inter["paso"] is not None else "sin_paso"
            a = self._buscar_elemento(inter["elemento_a_id"])
            b = self._buscar_elemento(inter["elemento_b_id"])
            if a is None or b is None:
                continue

            a1 = a["p1"] + offset
            a2 = a["p2"] + offset
            b1 = b["p1"] + offset
            b2 = b["p2"] + offset

            if a["tipo"] in {"palo", "cana"}:
                a1, a2 = self._extender_palo(a1, a2)
            if b["tipo"] in {"palo", "cana"}:
                b1, b2 = self._extender_palo(b1, b2)

            punto = self._punto_interseccion_aproximado(a1, a2, b1, b2)

            if inter_paso == paso_actual:
                amarre = inter["amarre_tipo"] if inter["amarre_tipo"] else "sin_amarre"
                color = self.colores_nudo.get(amarre, "#6d4c41")
                puntos_actual.append(punto)
                colores_actual.append(color)
            elif self._clave_orden_paso(inter_paso) < self._clave_orden_paso(paso_actual):
                puntos_prev.append(punto)

        if puntos_prev:
            p = np.array(puntos_prev)
            ax.scatter(p[:, 0], p[:, 1], p[:, 2], c="#303030", s=20, alpha=0.8, depthshade=False)
        if puntos_actual:
            p = np.array(puntos_actual)
            ax.scatter(p[:, 0], p[:, 1], p[:, 2], c=colores_actual, s=34, alpha=0.98, depthshade=False)

    def _render_escena_paso_manual(self, ax, paso_actual):
        offset = self._calcular_offset_escena()
        ids_previos, ids_actuales = self._ids_por_estado_en_paso(paso_actual)

        color_prev = np.array([0.65, 0.65, 0.65])
        color_actual = np.array([1.0, 0.55, 0.0])

        self._draw_plano_suelo(ax, offset)
        self._draw_rosa_vientos(ax)

        for elemento in self._palos:
            elemento_id = elemento["id"]
            
            if elemento_id in ids_actuales:
                color = color_actual
            elif elemento_id in ids_previos:
                color = color_prev
            else:
                continue

            p1 = elemento["p1"] + offset
            p2 = elemento["p2"] + offset
            tipo = elemento["tipo"]

            if tipo in {"palo", "cana"}:
                p1, p2 = self._extender_palo(p1, p2)

            if tipo == "soga":
                self._draw_soga(ax, p1, p2, color, self.grosor_soga)
            elif tipo == "cana":
                self._draw_palo_rapido(ax, p1, p2, color, self.grosor_cana)
            elif tipo == "tabla":
                ancho_tabla = float(elemento.get("ancho") or (self.tamano_palo_corto / 5.0))
                radio_tabla = max(self.grosor_tabla_min, ancho_tabla * 0.5) * 3.0
                self._draw_palo_rapido(ax, p1, p2, color, radio_tabla)
            else:
                self._draw_palo_rapido(ax, p1, p2, color, self.grosor_palo)

        self._draw_intersecciones_paso_manual(ax, offset, paso_actual)

        self._configurar_ejes_escena(ax)
        rotacion = self.get_rotacion_paso(paso_actual)
        rot_x = float(rotacion["x"])
        rot_z = float(rotacion["z"])
        elev_base = 45
        azim_base = 45
        ax.view_init(elev=elev_base + rot_x, azim=azim_base + rot_z)

        ax.text2D(
            0.02,
            0.98,
            f"↻ Rotar (Z vertical)  X:{rot_x:g}°  Z:{rot_z:g}°",
            transform=ax.transAxes,
            va="top",
            ha="left",
            fontsize=10,
            color="#1565c0",
            bbox={"facecolor": "white", "alpha": 0.7, "edgecolor": "#90caf9", "boxstyle": "round,pad=0.25"},
        )

        handles = [
            Line2D([0], [0], color=color_actual, lw=3, label="Se coloca en este paso"),
            Line2D([0], [0], color=color_prev, lw=3, label="Ya estaba construido"),
        ]
        ax.legend(handles=handles, loc="upper left", bbox_to_anchor=(1.02, 1.0), frameon=True)

    def exportar_manual_pdf(self, ruta_archivo, titulo="Manual de Construcción Scout"):
        materiales = self.generar_lista_materiales()
        resumen = self.generar_resumen_montaje()

        with PdfPages(ruta_archivo) as pdf:
            fig1 = plt.figure(figsize=(8.27, 11.69))
            fig1.clf()
            texto = []
            texto.append(titulo)
            texto.append("")
            texto.append("Resumen del proyecto")
            texto.append(f"- Elementos totales: {len(self._palos)}")
            texto.append(f"- Intersecciones: {len(self._intersecciones)}")
            texto.append(
                f"- Constructores (min/max): {self.constructores_min_proyecto if self.constructores_min_proyecto is not None else '-'} / {self.constructores_max_proyecto if self.constructores_max_proyecto is not None else '-'}"
            )
            texto.append("")
            texto.append("Materiales")
            texto.append(
                f"- Palos: {materiales['resumen']['palo']['cantidad']} (cortos={materiales['resumen']['palo']['corto']}, largos={materiales['resumen']['palo']['largo']}, personalizados={materiales['resumen']['palo']['personalizado']})"
            )
            texto.append(f"- Cañas: {materiales['resumen']['cana']['cantidad']}")
            texto.append(f"- Sogas: {materiales['resumen']['soga']['cantidad']}")
            texto.append(f"- Longitud total soga aprox: {materiales['resumen']['soga']['longitud_total']} m")

            fig1.text(0.08, 0.95, "\n".join(texto), va="top", fontsize=11, family="monospace")
            pdf.savefig(fig1)
            plt.close(fig1)

            for paso in sorted(resumen["pasos"].keys(), key=self._clave_orden_paso):
                fig = plt.figure(figsize=(8.27, 11.69))
                fig.clf()
                ax3d = fig.add_axes([0.08, 0.40, 0.70, 0.50], projection="3d")
                paso_data = resumen["pasos"][paso]
                inters = [
                    i for i in self._intersecciones if (i["paso"] if i["paso"] is not None else "sin_paso") == paso
                ]

                self._render_escena_paso_manual(ax3d, paso)

                lineas = []
                lineas.append(f"PASO {paso}")
                lineas.append("")
                lineas.append(f"Amarres en este paso: {paso_data['cantidad_amarres']}")
                lineas.append(
                    f"Constructores recomendados (min/max): {paso_data['constructores_min'] if paso_data['constructores_min'] is not None else '-'} / {paso_data['constructores_max'] if paso_data['constructores_max'] is not None else '-'}"
                )
                rot_paso = self.get_rotacion_paso(paso)
                lineas.append(f"Rotación acumulada del paso: X={rot_paso['x']:g}° | Z={rot_paso['z']:g}°")
                lineas.append("")
                comentario = self.get_comentario_paso(paso)
                if comentario:
                    lineas.append("Notas:")
                    lineas.append(comentario)
                    lineas.append("")
                lineas.append("Detalle de amarres:")

                for idx, inter in enumerate(inters, start=1):
                    lineas.append(
                        f"{idx}. E{inter['elemento_a_id']} ↔ E{inter['elemento_b_id']} | {inter['amarre_tipo']} | lado={inter['lado']} | desfase={inter['desfase']}"
                    )

                fig.text(0.08, 0.34, "\n".join(lineas), va="top", fontsize=10, family="monospace")
                pdf.savefig(fig)
                plt.close(fig)

    def set_grosor_palo(self, grosor):
        grosor = float(grosor)
        if grosor <= 0:
            raise ValueError("grosor debe ser > 0")
        self.grosor_palo = grosor

    def set_grosor_soga(self, grosor):
        grosor = float(grosor)
        if grosor <= 0:
            raise ValueError("grosor de soga debe ser > 0")
        self.grosor_soga = grosor

    def set_grosor_cana(self, grosor):
        grosor = float(grosor)
        if grosor <= 0:
            raise ValueError("grosor de cana debe ser > 0")
        self.grosor_cana = grosor

    def set_extension_palo(self, extension):
        extension = float(extension)
        if extension < 0:
            raise ValueError("extension debe ser >= 0")
        self.extension_palo = extension

    def set_modo_rapido(self, activo=True):
        self.modo_rapido = bool(activo)

    def set_resolucion_cilindro(self, theta=12, largo=4):
        theta = int(theta)
        largo = int(largo)
        if theta < 6 or largo < 2:
            raise ValueError("Resolución mínima: theta >= 6 y largo >= 2")
        self.resolucion_cilindro_theta = theta
        self.resolucion_cilindro_largo = largo

    def set_estilo_cilindro(self, antialias=False, shade=False):
        self.cilindro_antialias = bool(antialias)
        self.cilindro_shade = bool(shade)

    def set_centrar_en_centroide(self, activo=True):
        self.centrar_en_centroide = bool(activo)
        self._centroide = None

    def set_color_nudo(self, tipo_nudo, color):
        self.colores_nudo[str(tipo_nudo)] = color

    def set_mostrar_rosa_vientos(self, mostrar=True):
        self.mostrar_rosa_vientos = bool(mostrar)

    def set_mostrar_plano_suelo(self, mostrar=True):
        self.mostrar_plano_suelo = bool(mostrar)

    def set_estilo_plano_suelo(self, color="#43a047", alpha=0.32):
        alpha = float(alpha)
        if alpha < 0 or alpha > 1:
            raise ValueError("alpha del plano de suelo debe estar entre 0 y 1")
        self.color_plano_suelo = color
        self.alpha_plano_suelo = alpha

    def registrar_comentario_paso(self, paso, comentario):
        """Registra un comentario descriptivo para un paso específico de la construcción."""
        paso_key = str(paso) if paso is not None else "sin_paso"
        self._comentarios_paso[paso_key] = str(comentario)

    def get_comentario_paso(self, paso):
        """Obtiene el comentario registrado para un paso específico."""
        paso_key = str(paso) if paso is not None else "sin_paso"
        return self._comentarios_paso.get(paso_key, "")

    def registrar_rotacion_paso(self, paso, grados, eje="z"):
        """Define la rotación (en grados) por eje aplicada al paso.

        - eje='z': giro alrededor del eje vertical Z (vista en planta)
        - eje='x': inclinación / poner de cabeza
        La rotación se mantiene en los pasos siguientes hasta que se redefina.
        """
        paso_key = str(paso) if paso is not None else "sin_paso"
        eje = str(eje).lower()
        if eje not in {"x", "z"}:
            raise ValueError("eje debe ser 'x' o 'z'")

        actual = self._rotaciones_paso.get(paso_key, {"x": 0.0, "z": 0.0})
        if isinstance(actual, (int, float)):
            actual = {"x": 0.0, "z": float(actual)}

        actual[eje] = float(grados)
        self._rotaciones_paso[paso_key] = actual

    def get_rotacion_paso(self, paso, eje=None):
        """Obtiene la rotación efectiva para un paso (acumulada/heredada).

        - Sin eje: devuelve dict {'x': grados_x, 'z': grados_z}
        - Con eje='x' o eje='z': devuelve float para ese eje
        """
        paso_key = str(paso) if paso is not None else "sin_paso"
        if paso_key == "sin_paso":
            valor = self._rotaciones_paso.get(paso_key, {"x": 0.0, "z": 0.0})
            if isinstance(valor, (int, float)):
                valor = {"x": 0.0, "z": float(valor)}
            resultado = {"x": float(valor.get("x", 0.0)), "z": float(valor.get("z", 0.0))}
        else:
            objetivo = self._clave_orden_paso(paso_key)
            resultado = {"x": 0.0, "z": 0.0}

            acumuladas = []
            for key, valor in self._rotaciones_paso.items():
                if key == "sin_paso":
                    continue
                orden = self._clave_orden_paso(key)
                if orden <= objetivo:
                    acumuladas.append((orden, valor))

            acumuladas.sort(key=lambda item: item[0])

            for _, valor in acumuladas:
                if isinstance(valor, (int, float)):
                    valor = {"x": 0.0, "z": float(valor)}
                if "x" in valor:
                    resultado["x"] = float(valor["x"])
                if "z" in valor:
                    resultado["z"] = float(valor["z"])

        if eje is None:
            return resultado

        eje = str(eje).lower()
        if eje not in {"x", "z"}:
            raise ValueError("eje debe ser 'x' o 'z'")
        return resultado[eje]

    def registrar_amarre_paso(self, paso, amarre_tipo, constructores_min=None, constructores_max=None):
        """Registra metadatos de amarre para un paso sin crear sogas físicas.

        Evita la confusión habitual:
        - amarre: técnica de atado (metadato)
        - soga: elemento físico visible
        """
        if paso is None:
            raise ValueError("paso es obligatorio")

        paso_key = str(int(paso))
        amarre = str(amarre_tipo).strip()
        if not amarre:
            raise ValueError("amarre_tipo no puede ser vacío")

        if constructores_min is not None:
            constructores_min = int(constructores_min)
            if constructores_min < 1:
                raise ValueError("constructores_min debe ser >= 1")
        if constructores_max is not None:
            constructores_max = int(constructores_max)
            if constructores_max < 1:
                raise ValueError("constructores_max debe ser >= 1")
        if constructores_min is not None and constructores_max is not None and constructores_min > constructores_max:
            raise ValueError("constructores_min no puede ser mayor que constructores_max")

        actual = self._amarres_paso.get(
            paso_key,
            {"amarres": [], "constructores_min": None, "constructores_max": None},
        )

        if amarre not in actual["amarres"]:
            actual["amarres"].append(amarre)

        if constructores_min is not None:
            previo_min = actual.get("constructores_min")
            actual["constructores_min"] = constructores_min if previo_min is None else min(previo_min, constructores_min)
        if constructores_max is not None:
            previo_max = actual.get("constructores_max")
            actual["constructores_max"] = constructores_max if previo_max is None else max(previo_max, constructores_max)

        self._amarres_paso[paso_key] = actual

    def get_amarres_paso(self, paso=None):
        if paso is None:
            return {
                key: {
                    "amarres": list(value.get("amarres", [])),
                    "constructores_min": value.get("constructores_min"),
                    "constructores_max": value.get("constructores_max"),
                }
                for key, value in self._amarres_paso.items()
            }

        paso_key = str(int(paso))
        value = self._amarres_paso.get(paso_key, {"amarres": [], "constructores_min": None, "constructores_max": None})
        return {
            "amarres": list(value.get("amarres", [])),
            "constructores_min": value.get("constructores_min"),
            "constructores_max": value.get("constructores_max"),
        }

    def validar_estructura_basica(self, tolerancia=0.05):
        """Devuelve advertencias para detectar errores estructurales comunes en scripts de IA."""
        tolerancia = float(tolerancia)
        if tolerancia < 0:
            raise ValueError("tolerancia debe ser >= 0")

        warnings = []
        estructurales = [e for e in self._palos if e["tipo"] in {"palo", "cana", "tabla"}]

        extremos = []
        for e in estructurales:
            extremos.append((e["id"], e["p1"]))
            extremos.append((e["id"], e["p2"]))

        for e in estructurales:
            p1 = e["p1"]
            p2 = e["p2"]

            if min(float(p1[2]), float(p2[2])) <= tolerancia:
                continue

            conectado = False
            for other_id, punto in extremos:
                if other_id == e["id"]:
                    continue
                if np.linalg.norm(p1 - punto) <= tolerancia or np.linalg.norm(p2 - punto) <= tolerancia:
                    conectado = True
                    break

            if not conectado:
                etiqueta = e.get("etiqueta") or f"id={e['id']}"
                warnings.append(
                    f"Elemento potencialmente flotante: {etiqueta} ({e['tipo']}) no toca suelo ni conecta con otros extremos"
                )

        cantidad_sogas = sum(1 for e in self._palos if e["tipo"] == "soga")
        if cantidad_sogas > 0 and not self._amarres_paso and len(self._intersecciones) == 0:
            warnings.append(
                "Hay sogas físicas pero no hay amarres de paso registrados (usa registrar_amarre_paso o PASO_META)."
            )

        return warnings

    def imprimir_validacion_estructura(self, tolerancia=0.05):
        warnings = self.validar_estructura_basica(tolerancia=tolerancia)
        if not warnings:
            print("Validación estructural: OK")
            return

        print("Validación estructural: advertencias")
        for idx, warning in enumerate(warnings, start=1):
            print(f"  {idx}. {warning}")

    def _calcular_centroide(self):
        if not self._palos:
            return np.array([0.0, 0.0, 0.0])
        puntos = np.array([p for elemento in self._palos for p in (elemento["p1"], elemento["p2"])])
        return np.mean(puntos, axis=0)

    def _get_centroide(self):
        if self._centroide is None:
            self._centroide = self._calcular_centroide()
        return self._centroide

    def _get_palo_radius(self):
        if self.grosor_palo is not None:
            return self.grosor_palo

        min_step = min(
            self._space_size[0] / max(self._grid_count[0] - 1, 1),
            self._space_size[1] / max(self._grid_count[1] - 1, 1),
            self._space_size[2] / max(self._grid_count[2] - 1, 1),
        )
        return max(min_step * 0.10, 0.03)

    def _extender_palo(self, p1, p2):
        if self.extension_palo <= 0:
            return p1, p2

        direction = p2 - p1
        length = np.linalg.norm(direction)
        if length == 0:
            return p1, p2

        axis = direction / length
        extension_vector = axis * self.extension_palo
        return p1 - extension_vector, p2 + extension_vector

    def _draw_palo_rapido(self, ax, p1, p2, color, radius):
        line_width = max(1.0, radius * 18.0)
        ax.plot(
            [p1[0], p2[0]],
            [p1[1], p2[1]],
            [p1[2], p2[2]],
            color=color,
            linewidth=line_width,
            solid_capstyle="round",
        )

    def _draw_soga(self, ax, p1, p2, color, radius):
        line_width = max(1.0, radius * 18.0)
        ax.plot(
            [p1[0], p2[0]],
            [p1[1], p2[1]],
            [p1[2], p2[2]],
            color=color,
            linewidth=line_width,
            linestyle="--",
            alpha=0.95,
        )

    def _draw_cylinder(self, ax, p1, p2, color, radius):
        direction = p2 - p1
        length = np.linalg.norm(direction)
        if length == 0:
            return

        axis = direction / length

        if abs(axis[0]) < 0.9:
            helper = np.array([1.0, 0.0, 0.0])
        else:
            helper = np.array([0.0, 1.0, 0.0])

        v1 = np.cross(axis, helper)
        v1 /= np.linalg.norm(v1)
        v2 = np.cross(axis, v1)

        theta = np.linspace(0, 2 * np.pi, self.resolucion_cilindro_theta)
        z = np.linspace(0, length, self.resolucion_cilindro_largo)
        theta_grid, z_grid = np.meshgrid(theta, z)

        x = (
            p1[0]
            + axis[0] * z_grid
            + radius * np.cos(theta_grid) * v1[0]
            + radius * np.sin(theta_grid) * v2[0]
        )
        y = (
            p1[1]
            + axis[1] * z_grid
            + radius * np.cos(theta_grid) * v1[1]
            + radius * np.sin(theta_grid) * v2[1]
        )
        z_surface = (
            p1[2]
            + axis[2] * z_grid
            + radius * np.cos(theta_grid) * v1[2]
            + radius * np.sin(theta_grid) * v2[2]
        )

        ax.plot_surface(
            x,
            y,
            z_surface,
            color=color,
            linewidth=0,
            antialiased=self.cilindro_antialias,
            shade=self.cilindro_shade,
        )

    def _lado_a_vector(self, lado):
        mapa = {
            "norte": np.array([0.0, 1.0, 0.0]),
            "sur": np.array([0.0, -1.0, 0.0]),
            "este": np.array([1.0, 0.0, 0.0]),
            "oeste": np.array([-1.0, 0.0, 0.0]),
            "arriba": np.array([0.0, 0.0, 1.0]),
            "abajo": np.array([0.0, 0.0, -1.0]),
        }
        return mapa.get(lado, np.array([0.0, 0.0, 0.0]))

    def _punto_interseccion_aproximado(self, p1, p2, q1, q2):
        u = p2 - p1
        v = q2 - q1
        w = p1 - q1

        a = np.dot(u, u)
        b = np.dot(u, v)
        c = np.dot(v, v)
        d = np.dot(u, w)
        e = np.dot(v, w)

        eps = 1e-12
        denom = a * c - b * b

        if denom < eps:
            s = 0.5
            t = 0.5
        else:
            s = (b * e - c * d) / denom
            t = (a * e - b * d) / denom

        s = np.clip(s, 0.0, 1.0)
        t = np.clip(t, 0.0, 1.0)

        punto_p = p1 + s * u
        punto_q = q1 + t * v
        return 0.5 * (punto_p + punto_q)

    def _draw_rosa_vientos(self, ax):
        if not self.mostrar_rosa_vientos:
            return

        cx = self._space_size[0] * 0.15
        cy = self._space_size[1] * 0.15
        cz = 0.0

        radio = min(self._space_size[0], self._space_size[1]) * 0.07
        if radio <= 0:
            return

        # Eje Norte-Sur (Y)
        ax.plot([cx, cx], [cy - radio, cy + radio], [cz, cz], color="#263238", linewidth=2.0)
        # Eje Este-Oeste (X)
        ax.plot([cx - radio, cx + radio], [cy, cy], [cz, cz], color="#263238", linewidth=2.0)

        # Flechas de orientación
        arrow_len = radio * 0.28
        ax.quiver(cx, cy + radio - arrow_len, cz, 0, arrow_len, 0, color="#d32f2f", linewidth=1.8, arrow_length_ratio=0.45)
        ax.quiver(cx + radio - arrow_len, cy, cz, arrow_len, 0, 0, color="#1976d2", linewidth=1.8, arrow_length_ratio=0.45)

        txt_offset = radio * 0.35
        ax.text(cx, cy + radio + txt_offset, cz, "N", color="#d32f2f", fontsize=10, ha="center", va="center")
        ax.text(cx, cy - radio - txt_offset, cz, "S", color="#263238", fontsize=9, ha="center", va="center")
        ax.text(cx + radio + txt_offset, cy, cz, "E", color="#1976d2", fontsize=9, ha="center", va="center")
        ax.text(cx - radio - txt_offset, cy, cz, "O", color="#263238", fontsize=9, ha="center", va="center")

    def _draw_plano_suelo(self, ax, offset=None):
        if not self.mostrar_plano_suelo:
            return

        if offset is None:
            offset = np.array([0.0, 0.0, 0.0], dtype=float)

        x0 = float(offset[0])
        y0 = float(offset[1])
        z0 = float(offset[2])

        x = np.array([[x0, x0 + self._space_size[0]], [x0, x0 + self._space_size[0]]], dtype=float)
        y = np.array([[y0, y0], [y0 + self._space_size[1], y0 + self._space_size[1]]], dtype=float)
        z = np.full((2, 2), z0, dtype=float)

        ax.plot_surface(
            x,
            y,
            z,
            color=self.color_plano_suelo,
            alpha=self.alpha_plano_suelo,
            linewidth=0,
            antialiased=False,
            shade=False,
        )

        # Contorno del plano para que sea visible incluso con escenas densas.
        borde = "#1b5e20"
        ax.plot([x0, x0 + self._space_size[0]], [y0, y0], [z0, z0], color=borde, linewidth=1.4, alpha=0.9)
        ax.plot(
            [x0 + self._space_size[0], x0 + self._space_size[0]],
            [y0, y0 + self._space_size[1]],
            [z0, z0],
            color=borde,
            linewidth=1.4,
            alpha=0.9,
        )
        ax.plot(
            [x0 + self._space_size[0], x0],
            [y0 + self._space_size[1], y0 + self._space_size[1]],
            [z0, z0],
            color=borde,
            linewidth=1.4,
            alpha=0.9,
        )
        ax.plot([x0, x0], [y0 + self._space_size[1], y0], [z0, z0], color=borde, linewidth=1.4, alpha=0.9)

    def _draw_intersecciones(self, ax, offset):
        if not self._intersecciones:
            return

        puntos = []
        colores = []
        tipos_en_uso = []

        for inter in self._intersecciones:
            a = self._buscar_elemento(inter["elemento_a_id"])
            b = self._buscar_elemento(inter["elemento_b_id"])
            if a is None or b is None:
                continue

            a1 = a["p1"] + offset
            a2 = a["p2"] + offset
            b1 = b["p1"] + offset
            b2 = b["p2"] + offset

            if a["tipo"] in {"palo", "cana"}:
                a1, a2 = self._extender_palo(a1, a2)
            if b["tipo"] in {"palo", "cana"}:
                b1, b2 = self._extender_palo(b1, b2)

            punto = self._punto_interseccion_aproximado(a1, a2, b1, b2)

            paso = inter["paso"] if inter["paso"] is not None else "-"
            amarre = inter["amarre_tipo"] if inter["amarre_tipo"] else "sin_amarre"
            color = self.colores_nudo.get(amarre, "#6d4c41")

            puntos.append(punto)
            colores.append(color)
            if amarre not in tipos_en_uso:
                tipos_en_uso.append(amarre)

        if not puntos:
            return

        puntos = np.array(puntos)
        ax.scatter(
            puntos[:, 0],
            puntos[:, 1],
            puntos[:, 2],
            c=colores,
            s=30,
            alpha=0.95,
            depthshade=False,
        )

        handles = []
        for tipo in tipos_en_uso:
            color = self.colores_nudo.get(tipo, "#6d4c41")
            handles.append(
                Line2D(
                    [0],
                    [0],
                    marker="o",
                    color="w",
                    markerfacecolor=color,
                    markeredgecolor=color,
                    markersize=7,
                    label=tipo,
                )
            )

        if handles:
            ax.legend(
                handles=handles,
                title="Leyenda de nudos",
                loc="upper left",
                bbox_to_anchor=(1.02, 1.0),
                borderaxespad=0.0,
                frameon=True,
            )

    def _calcular_offset_escena(self):
        offset = np.array([0.0, 0.0, 0.0])
        if self.centrar_en_centroide and self._palos:
            centroide = self._get_centroide()
            centro_espacio = np.array([
                self._space_size[0] / 2,
                self._space_size[1] / 2,
                self._space_size[2] / 2,
            ])
            offset = centro_espacio - centroide
        return offset

    def _render_escena(self, ax, mostrar_puntos=False, tamanio_punto=16, mostrar_intersecciones=True):
        radius = self._get_palo_radius()
        offset = self._calcular_offset_escena()

        self._draw_plano_suelo(ax, offset)
        self._draw_rosa_vientos(ax)

        if mostrar_puntos:
            ax.scatter(
                self._grid_points[:, 0],
                self._grid_points[:, 1],
                self._grid_points[:, 2],
                c="black",
                s=tamanio_punto,
                alpha=0.85,
            )

        for elemento in self._palos:
            p1 = elemento["p1"]
            p2 = elemento["p2"]
            color = elemento["color"]
            tipo = elemento["tipo"]

            p1_ajust = p1 + offset
            p2_ajust = p2 + offset

            if tipo in {"palo", "cana"}:
                p1_ajust, p2_ajust = self._extender_palo(p1_ajust, p2_ajust)

            if tipo == "soga":
                self._draw_soga(ax, p1_ajust, p2_ajust, color, self.grosor_soga)
            elif tipo == "cana":
                if self.modo_rapido:
                    self._draw_palo_rapido(ax, p1_ajust, p2_ajust, color, self.grosor_cana)
                else:
                    self._draw_cylinder(ax, p1_ajust, p2_ajust, color, self.grosor_cana)
            elif tipo == "tabla":
                ancho_tabla = float(elemento.get("ancho") or (self.tamano_palo_corto / 5.0))
                radio_tabla = max(self.grosor_tabla_min, ancho_tabla * 0.5) * 3.0
                if self.modo_rapido:
                    self._draw_palo_rapido(ax, p1_ajust, p2_ajust, color, radio_tabla)
                else:
                    self._draw_cylinder(ax, p1_ajust, p2_ajust, color, radio_tabla)
            else:
                if self.modo_rapido:
                    self._draw_palo_rapido(ax, p1_ajust, p2_ajust, color, self.grosor_palo)
                else:
                    self._draw_cylinder(ax, p1_ajust, p2_ajust, color, self.grosor_palo)

        if mostrar_intersecciones:
            self._draw_intersecciones(ax, offset)

    def _configurar_ejes_escena(self, ax, offset=None):
        if offset is None:
            offset = np.array([0.0, 0.0, 0.0], dtype=float)

        ax.set_xlim(float(offset[0]), float(offset[0]) + self._space_size[0])
        ax.set_ylim(float(offset[1]), float(offset[1]) + self._space_size[1])
        ax.set_zlim(float(offset[2]), float(offset[2]) + self._space_size[2])
        ax.set_box_aspect(self._space_size)

        ax.grid(False)
        ax.set_axis_off()

    def show(self, mostrar_puntos=False, tamanio_punto=16, mostrar_intersecciones=True):
        if self._grid_points is None:
            raise RuntimeError("Primero debes llamar a definir_espacio(...)")

        fig = plt.figure(figsize=(10, 8))
        ax = fig.add_subplot(111, projection="3d")

        self._render_escena(
            ax,
            mostrar_puntos=mostrar_puntos,
            tamanio_punto=tamanio_punto,
            mostrar_intersecciones=mostrar_intersecciones,
        )

        offset = self._calcular_offset_escena()
        self._configurar_ejes_escena(ax, offset)

        plt.tight_layout()
        plt.show()

    def exportar_gif_rotacion_horizontal(
        self,
        ruta_archivo,
        segundos=6,
        fps=12,
        elevacion=20,
        mostrar_puntos=False,
        tamanio_punto=16,
        mostrar_intersecciones=True,
    ):
        if self._grid_points is None:
            raise RuntimeError("Primero debes llamar a definir_espacio(...)")

        segundos = max(float(segundos), 0.5)
        fps = max(int(fps), 1)
        frames = max(int(segundos * fps), 2)

        fig = plt.figure(figsize=(10, 8))
        ax = fig.add_subplot(111, projection="3d")

        self._render_escena(
            ax,
            mostrar_puntos=mostrar_puntos,
            tamanio_punto=tamanio_punto,
            mostrar_intersecciones=mostrar_intersecciones,
        )
        offset = self._calcular_offset_escena()
        self._configurar_ejes_escena(ax, offset)

        def _update(frame):
            azim = (360.0 * frame) / frames
            ax.view_init(elev=elevacion, azim=azim)
            return []

        anim = FuncAnimation(fig, _update, frames=frames, interval=1000 / fps, blit=False)
        writer = PillowWriter(fps=fps)
        anim.save(ruta_archivo, writer=writer)
        plt.close(fig)