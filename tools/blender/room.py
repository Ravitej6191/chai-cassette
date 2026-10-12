"""
Chai & Cassette — static room, built in Blender from the same measurements the web scene uses.

Run headless:
    blender --background --python tools/blender/room.py -- --preview out.png [--samples 48] [--cam default|deck|table]
    blender --background --python tools/blender/room.py -- --bake            [--size 4096]

Coordinates: the web app is three.js (Y up, +Z toward the viewer); Blender is Z up. T() converts
(x, y, z)_three  →  (x, -z, y)_blender. All lengths are metres.
"""
import math
import os
import sys

import bpy
from mathutils import Vector

# --------------------------------------------------------------------------- args
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg(name, default=None, cast=str):
    if name in argv:
        i = argv.index(name)
        if i + 1 < len(argv) and not argv[i + 1].startswith("--"):
            return cast(argv[i + 1])
        return True
    return default


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ASSETS = os.path.join(ROOT, "public", "assets")
OUT = os.path.join(ROOT, "tools", "blender", "out")
os.makedirs(OUT, exist_ok=True)


def T(x, y, z):
    return Vector((x, -z, y))


# --------------------------------------------------------------------------- scene reset
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.unit_settings.system = "METRIC"

# --------------------------------------------------------------------------- constants (mirror src/layout.ts)
TABLE_TOP = 0.76
ROOM_W, ROOM_D, ROOM_H, BACK_Z = 4.4, 4.6, 2.8, -0.9
WIN = dict(x=0.15, y=1.62, w=2.1, h=1.45)
DECK_POS = (0.0, TABLE_TOP + 0.003 + 0.15, -0.15)
LAMP_POS = (0.84, TABLE_TOP, -0.34)
CHAI_POS = (0.62, TABLE_TOP, 0.10)
RACK_POS = (-0.78, TABLE_TOP, -0.30)

collections = {}


def coll(name):
    if name not in collections:
        c = bpy.data.collections.new(name)
        scene.collection.children.link(c)
        collections[name] = c
    return collections[name]


# --------------------------------------------------------------------------- materials
def _img(path, colorspace="sRGB"):
    img = bpy.data.images.load(path, check_existing=True)
    img.colorspace_settings.name = colorspace
    return img


def pbr_material(name, tex_id, tile, tint=(1, 1, 1, 1), normal_strength=0.8):
    """Textured PBR with box projection in object space, `tile` metres per texture repeat."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (1 / tile, 1 / tile, 1 / tile)
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])

    def tex(fn, cs):
        n = nt.nodes.new("ShaderNodeTexImage")
        n.image = _img(os.path.join(ASSETS, "tex", tex_id, fn), cs)
        n.projection = "BOX"
        n.projection_blend = 0.25
        nt.links.new(mp.outputs["Vector"], n.inputs["Vector"])
        return n

    d = tex("diff.webp", "sRGB")
    r = tex("rough.webp", "Non-Color")
    nm = tex("nor.webp", "Non-Color")
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "MULTIPLY"
    mix.inputs[0].default_value = 1.0
    mix.inputs[7].default_value = tint
    nt.links.new(d.outputs["Color"], mix.inputs[6])
    nt.links.new(mix.outputs[2], bsdf.inputs["Base Color"])
    nt.links.new(r.outputs["Color"], bsdf.inputs["Roughness"])
    nmap = nt.nodes.new("ShaderNodeNormalMap")
    nmap.inputs["Strength"].default_value = normal_strength
    nt.links.new(nm.outputs["Color"], nmap.inputs["Color"])
    nt.links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return m


def plain_material(name, color, rough=0.7, metal=0.0, emission=None, emission_strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = color
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emission:
        b.inputs["Emission Color"].default_value = emission
        b.inputs["Emission Strength"].default_value = emission_strength
    return m


def rug_material():
    """Muted red rug with an indigo border band and a medallion, from UV space (no image needed)."""
    m = bpy.data.materials.new("rug")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Roughness"].default_value = 0.97
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Generated"], sep.inputs["Vector"])
    # distance to the nearest edge in 0..0.5
    def math_node(op, a=None, b=None):
        n = nt.nodes.new("ShaderNodeMath")
        n.operation = op
        return n

    # edge distance: min(min(x,1-x), min(y,1-y))
    ox = math_node("SUBTRACT"); ox.inputs[0].default_value = 1.0
    nt.links.new(sep.outputs["X"], ox.inputs[1])
    mx = math_node("MINIMUM"); nt.links.new(sep.outputs["X"], mx.inputs[0]); nt.links.new(ox.outputs[0], mx.inputs[1])
    oy = math_node("SUBTRACT"); oy.inputs[0].default_value = 1.0
    nt.links.new(sep.outputs["Y"], oy.inputs[1])
    my = math_node("MINIMUM"); nt.links.new(sep.outputs["Y"], my.inputs[0]); nt.links.new(oy.outputs[0], my.inputs[1])
    ed = math_node("MINIMUM"); nt.links.new(mx.outputs[0], ed.inputs[0]); nt.links.new(my.outputs[0], ed.inputs[1])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.interpolation = "CONSTANT"
    stops = [
        (0.00, (0.55, 0.45, 0.28, 1)),   # outer gold line
        (0.012, (0.30, 0.10, 0.09, 1)),  # red
        (0.03, (0.78, 0.68, 0.46, 1)),   # gold hairline
        (0.045, (0.07, 0.10, 0.20, 1)),  # indigo band
        (0.10, (0.73, 0.62, 0.40, 1)),   # gold line
        (0.108, (0.28, 0.09, 0.08, 1)),  # red field
    ]
    ramp.color_ramp.elements[0].position = stops[0][0]
    ramp.color_ramp.elements[0].color = stops[0][1]
    for pos, col in stops[1:]:
        e = ramp.color_ramp.elements.new(pos)
        e.color = col
    nt.links.new(ed.outputs[0], ramp.inputs["Fac"])
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 260
    noise.inputs["Detail"].default_value = 6
    mixn = nt.nodes.new("ShaderNodeMix")
    mixn.data_type = "RGBA"
    mixn.blend_type = "MULTIPLY"
    mixn.inputs[0].default_value = 0.35
    nt.links.new(ramp.outputs["Color"], mixn.inputs[6])
    nt.links.new(noise.outputs["Color"], mixn.inputs[7])
    nt.links.new(mixn.outputs[2], bsdf.inputs["Base Color"])
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return m


MAT = {}


def build_materials():
    MAT["floor"] = pbr_material("floor", "old_wooden_floor_02", 1.5, (0.85, 0.78, 0.69, 1))
    MAT["wall"] = pbr_material("wall", "painted_plaster_wall", 1.7, (0.80, 0.75, 0.65, 1))
    MAT["ceiling"] = plain_material("ceiling", (0.55, 0.50, 0.42, 1), 0.95)
    MAT["skirting"] = plain_material("skirting", (0.09, 0.05, 0.025, 1), 0.6)
    MAT["table_top"] = pbr_material("table_top", "wood_table_001", 1.1, (1, 1, 1, 1))
    MAT["table_dark"] = pbr_material("table_dark", "dark_wood", 0.8, (0.80, 0.71, 0.60, 1))
    MAT["table_apron"] = pbr_material("table_apron", "dark_wood", 0.8, (0.60, 0.50, 0.41, 1))
    MAT["case"] = pbr_material("case", "dark_wood", 0.9, (0.72, 0.60, 0.49, 1))
    MAT["rack"] = pbr_material("rack", "dark_wood", 0.9, (0.73, 0.62, 0.50, 1))
    MAT["case_back"] = plain_material("case_back", (0.04, 0.02, 0.012, 1), 0.9)
    MAT["steel"] = plain_material("steel", (0.035, 0.04, 0.045, 1), 0.55, 0.6)
    MAT["rug"] = rug_material()
    # occluders only
    MAT["occ"] = plain_material("occ", (0.12, 0.10, 0.09, 1), 0.8)
    MAT["occ_light"] = plain_material("occ_light", (0.6, 0.55, 0.45, 1), 0.9)
    MAT["brass"] = plain_material("brass", (0.72, 0.52, 0.2, 1), 0.3, 1.0)
    MAT["shade"] = plain_material("shade", (0.95, 0.78, 0.5, 1), 0.9, emission=(1.0, 0.62, 0.25, 1), emission_strength=2.5)


# --------------------------------------------------------------------------- geometry helpers
def box(name, size, center, mat, group, rot_y=0.0):
    """size/center in three.js axes (x, y, z)."""
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.active_object
    o.name = name
    o.scale = (size[0], size[2], size[1])
    o.location = T(*center)
    if rot_y:
        o.rotation_euler[2] = -rot_y
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    o.data.materials.append(mat)
    o["group"] = group
    for c in o.users_collection:
        c.objects.unlink(o)
    coll(group).objects.link(o)
    return o


def cylinder(name, r1, r2, h, center, mat, group, verts=32):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r1, radius2=r2, depth=h)
    o = bpy.context.active_object
    o.name = name
    o.location = T(*center)
    o.data.materials.append(mat)
    o["group"] = group
    for c in o.users_collection:
        c.objects.unlink(o)
    coll(group).objects.link(o)
    bpy.ops.object.shade_smooth()
    return o


def inside_out_room(name, mat, group):
    """Room shell as one box whose faces point inward, with a window opening in the back wall."""
    import bmesh

    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    hw = ROOM_W / 2
    z0, z1 = BACK_Z, BACK_Z + ROOM_D

    def quad(pts, flip=False):
        vs = [bm.verts.new(T(*p)) for p in pts]
        if flip:
            vs.reverse()
        return bm.faces.new(vs)

    # floor, ceiling (normals face into the room)
    quad([(-hw, 0, z0), (hw, 0, z0), (hw, 0, z1), (-hw, 0, z1)], flip=True)
    quad([(-hw, ROOM_H, z0), (hw, ROOM_H, z0), (hw, ROOM_H, z1), (-hw, ROOM_H, z1)])
    # side walls and front wall
    quad([(-hw, 0, z0), (-hw, ROOM_H, z0), (-hw, ROOM_H, z1), (-hw, 0, z1)], flip=True)
    quad([(hw, 0, z0), (hw, ROOM_H, z0), (hw, ROOM_H, z1), (hw, 0, z1)])
    quad([(-hw, 0, z1), (hw, 0, z1), (hw, ROOM_H, z1), (-hw, ROOM_H, z1)], flip=True)
    # back wall as four panels around the window
    wx0, wx1 = WIN["x"] - WIN["w"] / 2, WIN["x"] + WIN["w"] / 2
    wy0, wy1 = WIN["y"] - WIN["h"] / 2, WIN["y"] + WIN["h"] / 2
    back = [
        [(-hw, 0, z0), (hw, 0, z0), (hw, wy0, z0), (-hw, wy0, z0)],
        [(-hw, wy1, z0), (hw, wy1, z0), (hw, ROOM_H, z0), (-hw, ROOM_H, z0)],
        [(-hw, wy0, z0), (wx0, wy0, z0), (wx0, wy1, z0), (-hw, wy1, z0)],
        [(wx1, wy0, z0), (hw, wy0, z0), (hw, wy1, z0), (wx1, wy1, z0)],
    ]
    for q in back:
        quad(q)
    # window reveal (4 short faces so light does not leak around the frame)
    d = 0.12
    quad([(wx0, wy0, z0), (wx1, wy0, z0), (wx1, wy0, z0 - d), (wx0, wy0, z0 - d)])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    coll(group).objects.link(o)
    o.data.materials.append(mat)
    o["group"] = group
    return o


# --------------------------------------------------------------------------- the room
def rug_plane():
    bpy.ops.mesh.primitive_plane_add(size=1)
    o = bpy.context.active_object
    o.name = "rug"
    o.scale = (2.8, 2.0, 1)
    o.location = T(0, 0.002, 0.2)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    o.data.materials.append(MAT["rug"])
    o["group"] = "furniture"
    for c in o.users_collection:
        c.objects.unlink(o)
    coll("furniture").objects.link(o)


def build_static():
    G = "shell"
    inside_out_room("shell_room", MAT["wall"], G)
    # separate materials per face region are assigned after creation (floor / ceiling)
    room = bpy.data.objects["shell_room"]
    room.data.materials.append(MAT["floor"])
    room.data.materials.append(MAT["ceiling"])
    for p in room.data.polygons:
        n = p.normal
        c = p.center
        if abs(n.z) > 0.99 and n.z > 0 and c.z < 0.05:
            p.material_index = 1  # floor
        elif abs(n.z) > 0.99 and n.z < 0 and c.z > ROOM_H - 0.05:
            p.material_index = 2  # ceiling
    hw = ROOM_W / 2
    box("skirt_back", (ROOM_W, 0.12, 0.024), (0, 0.06, BACK_Z + 0.012), MAT["skirting"], G)
    mid = BACK_Z + ROOM_D / 2
    for s in (-1, 1):
        box(f"skirt_{s}", (0.024, 0.12, ROOM_D), (s * (hw - 0.012), 0.06, mid), MAT["skirting"], G)

    F = "furniture"
    # rug
    rug_plane()
    # table
    box("table_top", (2.2, 0.05, 0.8), (0, TABLE_TOP - 0.025, -0.1), MAT["table_top"], F)
    box("table_apron", (2.08, 0.08, 0.68), (0, TABLE_TOP - 0.05 - 0.02, -0.1), MAT["table_apron"], F)
    lx, lz = 1.1 - 0.09, 0.4 - 0.08
    for sx in (-1, 1):
        for sz in (-1, 1):
            cylinder(f"table_leg_{sx}{sz}", 0.024, 0.035, TABLE_TOP - 0.05, (sx * lx, (TABLE_TOP - 0.05) / 2, -0.1 + sz * lz), MAT["table_dark"], F)
    F = "occluders"  # live in the web app; here they only cast shadows
    # window frame (dark steel)
    w, h = WIN["w"], WIN["h"]
    wx, wy = WIN["x"], WIN["y"]
    parts = [
        ((w + 0.1, 0.06, 0.12), (0, h / 2 + 0.025, 0.04)),
        ((w + 0.16, 0.06, 0.2), (0, -h / 2 - 0.025, 0.06)),
        ((0.06, h, 0.12), (-w / 2 - 0.025, 0, 0.04)),
        ((0.06, h, 0.12), (w / 2 + 0.025, 0, 0.04)),
        ((w, 0.035, 0.07), (0, h * 0.18, 0.02)),
        ((0.04, h, 0.07), (-w / 6, 0, 0.02)),
        ((0.04, h, 0.07), (w / 6, 0, 0.02)),
    ]
    for i, (sz, c) in enumerate(parts):
        box(f"win_{i}", sz, (wx + c[0], wy + c[1], BACK_Z + c[2]), MAT["steel"], F)
    # bookcase carcass
    bx, bz = -1.8, -0.74
    bw, bh, bd = 0.7, 1.5, 0.3
    rows = 4
    row_h = (bh - 0.05) / rows
    for s in (-1, 1):
        box(f"case_side_{s}", (0.02, bh, bd), (bx + s * (bw / 2 + 0.01), bh / 2, bz), MAT["case"], F)
    for i in range(rows + 1):
        box(f"case_shelf_{i}", (bw + 0.04, 0.025, bd), (bx, i * row_h + 0.02, bz), MAT["case"], F)
    box("case_back", (bw, bh, 0.01), (bx, bh / 2, bz - bd / 2 + 0.005), MAT["case_back"], F)
    # rack
    rw = 4 * 0.108 + 0.03
    for t in range(3):
        front = 0.075 - t * 0.035 + 0.032
        back = -0.05
        d = front - back
        zc = (front + back) / 2
        box(f"rack_board_{t}", (rw, 0.01, d), (RACK_POS[0], RACK_POS[1] + t * 0.075 + 0.005, RACK_POS[2] + zc), MAT["rack"], F)
        box(f"rack_lip_{t}", (rw, 0.012, 0.006), (RACK_POS[0], RACK_POS[1] + t * 0.075 + 0.0125, RACK_POS[2] + front - 0.003), MAT["rack"], F)
        for s in (-1, 1):
            box(f"rack_side_{t}_{s}", (0.012, 0.075, d), (RACK_POS[0] + s * (rw / 2 + 0.006), RACK_POS[1] + (t + 0.5) * 0.075, RACK_POS[2] + zc), MAT["rack"], F)
    box("rack_back", (rw + 0.03, 0.245, 0.012), (RACK_POS[0], RACK_POS[1] + 0.12, RACK_POS[2] - 0.05), MAT["rack"], F)


def build_occluders():
    """Things that live in the room but are drawn live by the web app: they only cast shadows/bounce here."""
    G = "occluders"
    # deck (box proxy) and its feet
    box("deck", (0.86, 0.30, 0.26), DECK_POS, MAT["occ"], G)
    # books on the shelves (dark mass so the shelves are not lit through)
    bx, bz = -1.8, -0.74
    row_h = (1.5 - 0.05) / 4
    for i in range(4):
        box(f"books_{i}", (0.66, row_h * 0.78, 0.2), (bx, 0.033 + i * row_h + row_h * 0.39, bz + 0.02), MAT["occ"], G)
    # table lamp
    lx, ly, lz = LAMP_POS
    cylinder("lamp_base", 0.085, 0.07, 0.028, (lx, ly + 0.014, lz), MAT["brass"], G)
    cylinder("lamp_stem", 0.012, 0.009, 0.28, (lx, ly + 0.17, lz), MAT["brass"], G, 12)
    shade = cylinder("lamp_shade", 0.17, 0.1, 0.2, (lx, ly + 0.39, lz), MAT["shade"], G)
    shade.visible_shadow = False  # the lamp's own light must get out through its shade
    # chai on its dabarah
    cx, cy, cz = CHAI_POS
    cylinder("chai_saucer", 0.086, 0.07, 0.026, (cx, cy + 0.013, cz), MAT["occ_light"], G)
    cylinder("chai_glass", 0.04, 0.034, 0.1, (cx, cy + 0.075, cz), MAT["occ_light"], G)
    # notebook, books stack
    box("notebook", (0.2, 0.012, 0.14), (0.42, TABLE_TOP + 0.006, 0.12), MAT["occ_light"], G, rot_y=-0.25)
    for i, (y, w, r) in enumerate([(0.012, 0.2, 0.1), (0.036, 0.18, -0.06), (0.056, 0.16, 0.2)]):
        box(f"stack_{i}", (w, 0.024, 0.13), (0.62, TABLE_TOP + y, -0.4), MAT["occ_light"], G, rot_y=r)
    # curtains (thin planes)
    for s, x in ((-1, WIN["x"] - WIN["w"] / 2 - 0.22), (1, WIN["x"] + WIN["w"] / 2 + 0.22)):
        box(f"curtain_{s}", (0.62, 2.62, 0.04), (x, 1.33, BACK_Z + 0.16), MAT["occ_light"], G)


# models imported from the web app's assets (chair, plants, ...), placed exactly as in Props.tsx
def import_model(name, fit, value, pos, rot_y=0.0, rot_z=0.0):
    path = os.path.join(ASSETS, "models", name, f"{name}.glb")
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    root = bpy.data.objects.new(f"model_{name}", None)
    coll("occluders").objects.link(root)
    for o in new:
        for c in list(o.users_collection):
            c.objects.unlink(o)
        coll("occluders").objects.link(o)
        if o.parent is None:
            o.parent = root
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ Vector(c) for o in new if o.type == "MESH" for c in o.bound_box]
    if not pts:
        return
    mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    size = mx - mn  # blender axes: x, y (=-z three), z (=y three)
    k = {"height": value / size.z, "width": value / size.x, "max": value / max(size)}[fit]
    root.scale = (k, k, k)
    root.rotation_euler = (0, 0, -rot_y)
    root.location = T(*pos)
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ Vector(c) for o in new if o.type == "MESH" for c in o.bound_box]
    cx = (min(p.x for p in pts) + max(p.x for p in pts)) / 2
    cy = (min(p.y for p in pts) + max(p.y for p in pts)) / 2
    zmin = min(p.z for p in pts)
    root.location += Vector((T(*pos).x - cx, T(*pos).y - cy, T(*pos).z - zmin))


def build_models():
    TT = TABLE_TOP
    import_model("calathea_orbifolia_01", "max", 0.85, (1.7, 0, -0.38), 0.6)
    import_model("potted_plant_02", "height", 0.5, (-1.14, 0, -0.76), 3.4)
    import_model("potted_plant_02", "height", 0.3, (0.96, TT, -0.06), 0.4)
    import_model("WoodenChair_01", "width", 0.48, (-1.2, 0, 0.66), 2.5)
    import_model("wicker_basket_01", "max", 0.5, (0.5, 0, -0.1), 0.4)
    import_model("ArmChair_01", "height", 0.95, (-1.95, 0, 1.55), 0.9)
    import_model("boombox", "width", 0.46, (-1.98, 1.5, -0.72), 0.28)
    import_model("Ukulele_01", "height", 0.55, (-1.4, 0.04, -0.52), 0.3)
    import_model("mantel_clock_01", "width", 0.2, (1.14, 0.9, -0.8), -0.3)
    import_model("brass_diya_lantern", "height", 0.2, (0.86, TT, 0.14), 0.0)


# --------------------------------------------------------------------------- lights (mirror the 'night' preset)
def point(name, loc, color, watts, radius=0.05):
    d = bpy.data.lights.new(name, "POINT")
    d.color = color
    d.energy = watts
    d.shadow_soft_size = radius
    o = bpy.data.objects.new(name, d)
    o.location = T(*loc)
    coll("lights").objects.link(o)
    return o


def build_lights():
    lx, ly, lz = LAMP_POS
    # table lamp bulb inside the shade
    point("lamp", (lx, ly + 0.38, lz), (1.0, 0.70, 0.40), LAMP_W, 0.045)
    # window: a cool soft panel filling the opening (moon / street / sky)
    a = bpy.data.lights.new("window", "AREA")
    a.shape = "RECTANGLE"
    a.size = WIN["w"]
    a.size_y = WIN["h"]
    a.color = (0.56, 0.65, 0.82)
    a.energy = WINDOW_W
    o = bpy.data.objects.new("window", a)
    o.location = T(WIN["x"], WIN["y"], BACK_Z - 0.05)
    o.rotation_euler = (-math.pi / 2, 0, 0)
    coll("lights").objects.link(o)
    # little lamp on the bookcase, the diya, the fan light
    point("case_lamp", (-1.8 + 0.25, 1.62, -0.72), (1.0, 0.70, 0.38), 12, 0.03)
    point("diya", (0.86, TABLE_TOP + 0.1, 0.17), (1.0, 0.62, 0.30), 2.2, 0.02)
    f = point("fan", (0, ROOM_H - 0.06, -0.1), (1.0, 0.82, 0.60), 14, 0.08)
    # world: very dark cool ambient
    w = bpy.data.worlds.new("night")
    w.use_nodes = True
    bg = w.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.012, 0.016, 0.03, 1)
    bg.inputs["Strength"].default_value = 1.0
    scene.world = w


# --------------------------------------------------------------------------- camera & render
CAMS = {
    "default": ((0.2, 1.38, 1.9), (-0.1, 1.05, -0.2), 45),
    "deck": ((0.0, 1.05, 0.9), (0.0, 0.92, -0.1), 45),
    "table": ((0.7, 1.1, 0.8), (0.55, 0.85, 0.0), 45),
    "wide": ((0.3, 1.6, 3.4), (-0.1, 1.15, -0.3), 45),
    "left": ((-0.6, 1.3, 1.3), (-1.4, 0.95, -0.6), 45),
}


def setup_camera(name):
    loc, tgt, fov = CAMS[name]
    cam = bpy.data.cameras.new("cam")
    cam.sensor_fit = "VERTICAL"
    cam.angle_y = math.radians(fov)
    co = bpy.data.objects.new("cam", cam)
    co.location = T(*loc)
    scene.collection.objects.link(co)
    empty = bpy.data.objects.new("target", None)
    empty.location = T(*tgt)
    scene.collection.objects.link(empty)
    con = co.constraints.new("TRACK_TO")
    con.target = empty
    con.track_axis = "TRACK_NEGATIVE_Z"
    con.up_axis = "UP_Y"
    scene.camera = co


def enable_gpu():
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for kind in ("OPTIX", "CUDA", "HIP", "NONE"):
        try:
            prefs.compute_device_type = kind
            prefs.get_devices()
            devs = [d for d in prefs.devices if d.type != "CPU"]
            if devs and kind != "NONE":
                for d in prefs.devices:
                    d.use = d.type != "CPU"
                scene.cycles.device = "GPU"
                print("GPU:", kind, [d.name for d in devs])
                return
        except Exception as e:  # noqa
            print("compute type", kind, "failed:", e)
    scene.cycles.device = "CPU"
    print("CPU render")


LAMP_W = arg("--lamp", 90.0, float)
WINDOW_W = arg("--window", 300.0, float)



# --------------------------------------------------------------------------- bake
TILE = {"floor": 1.5, "wall": 1.7, "table_top": 1.1, "table_dark": 0.8, "table_apron": 0.8}


def bake_room(size):
    import numpy as np

    static = [o for o in bpy.data.objects if o.type == "MESH" and o.get("group") in ("shell", "furniture")]
    bpy.ops.object.select_all(action="DESELECT")
    # UV1: tiled box projection per material (metres / tile), rug keeps its 0..1 plane UVs
    for o in static:
        bpy.context.view_layer.objects.active = o
        o.select_set(True)
        me = o.data
        if o.name == "rug":
            me.uv_layers[0].name = "UV1"
        else:
            if not me.uv_layers:
                me.uv_layers.new(name="UV1")
            me.uv_layers[0].name = "UV1"
            bpy.ops.object.mode_set(mode="EDIT")
            for i, slot in enumerate(o.material_slots):
                bpy.ops.mesh.select_all(action="DESELECT")
                o.active_material_index = i
                bpy.ops.object.material_slot_select()
                tile = TILE.get(slot.material.name, 1.0)
                bpy.ops.uv.cube_project(cube_size=tile, correct_aspect=True, scale_to_bounds=False)
            bpy.ops.object.mode_set(mode="OBJECT")
        o.select_set(False)
    # join into one mesh
    for o in static:
        o.select_set(True)
    bpy.context.view_layer.objects.active = static[0]
    bpy.ops.object.join()
    room = bpy.context.active_object
    room.name = "room_static"
    me = room.data
    uv2 = me.uv_layers.new(name="UV2")
    me.uv_layers.active = uv2
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.004, area_weight=0.6)
    bpy.ops.object.mode_set(mode="OBJECT")

    img = bpy.data.images.new("lightmap", size, size, float_buffer=True)
    for slot in room.material_slots:
        nt = slot.material.node_tree
        n = nt.nodes.new("ShaderNodeTexImage")
        n.image = img
        nt.nodes.active = n
        n.select = True

    scene.cycles.samples = arg("--bake-samples", 160, int)
    scene.cycles.use_denoising = True
    scene.render.bake.use_pass_direct = True
    scene.render.bake.use_pass_indirect = True
    scene.render.bake.use_pass_color = False
    scene.render.bake.margin = 6
    bpy.ops.object.select_all(action="DESELECT")
    room.select_set(True)
    bpy.context.view_layer.objects.active = room
    print("BAKING", len(me.polygons), "faces at", size)
    bpy.ops.object.bake(type="DIFFUSE")

    px = np.array(img.pixels[:], dtype=np.float32).reshape(-1, 4)
    lum = px[:, :3].mean(axis=1)
    k = float(np.percentile(lum, 99.7))
    print("lightmap p99.7 =", k)
    scale = 1.0 / max(k, 1e-4)
    out = px.copy()
    out[:, :3] = np.clip(out[:, :3] * scale, 0, 1)
    print("lightmap mean", float(px[:, :3].mean()), "nonzero", float((lum > 0).mean()), "scaled mean", float(out[:, :3].mean()))
    img.pixels.foreach_set(out.ravel())
    img.update()
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.display_settings.display_device = "sRGB"
    img.save_render(os.path.join(OUT, "lightmap.png"), scene=scene)
    with open(os.path.join(ROOT, "src", "scene", "lightmap.json"), "w") as f:
        f.write('{"scale": %f}' % (1.0 / scale))

    # remove bake nodes, export geometry only (materials by name, UV1 = tiled, UV2 = lightmap)
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(ASSETS, "models", "room_baked.glb"),
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_image_format="NONE",
    )
    print("EXPORTED")


def main():
    build_materials()
    build_static()
    build_occluders()
    build_models()
    build_lights()
    enable_gpu()
    scene.view_settings.view_transform = "AgX"
    scene.cycles.use_denoising = True
    if arg("--preview"):
        setup_camera(arg("--cam", "default"))
        scene.render.resolution_x = 1024
        scene.render.resolution_y = 768
        scene.cycles.samples = arg("--samples", 48, int)
        scene.render.filepath = os.path.abspath(arg("--preview"))
        bpy.ops.render.render(write_still=True)
        print("WROTE", scene.render.filepath)
    if arg("--bake"):
        bake_room(arg("--size", 4096, int))
    if arg("--save"):
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "room.blend"))


main()
