"""Robot de fotos: descarga las fotos reales de Wikimedia Commons a /img y arma
la imagen de vista previa (og.jpg) y los íconos de la app con esas fotos.
Lo corre GitHub Actions (.github/workflows/fotos.yml)."""
import io, os, re, sys, time, urllib.parse, urllib.request
from PIL import Image, ImageDraw, ImageFont, ImageFilter

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(RAIZ, "img")
os.makedirs(IMG, exist_ok=True)
UA = "VibrasPositivasHM-VacunadoresBot/1.0 (https://vacunadores-asogauca.netlify.app; contacto WhatsApp 3117700431)"

# Lee la lista de fotos directamente de comun.js para no repetirla
texto = open(os.path.join(RAIZ, "comun.js"), encoding="utf-8").read()
bloque = texto.split("const FOTOS = {", 1)[1].split("};", 1)[0]
FOTOS = dict(re.findall(r'^\s*(\w+):\s*\["([^"]+)"', bloque, re.M))


def bajar(nombre, ancho=1400):
    url = "https://commons.wikimedia.org/wiki/Special:FilePath/" + urllib.parse.quote(nombre) + f"?width={ancho}"
    for intento in range(4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                return Image.open(io.BytesIO(r.read())).convert("RGB")
        except Exception as e:  # noqa
            print("  reintento", intento + 1, nombre, e)
            time.sleep(3 + intento * 4)
    return None


def recorte(im, w, h):
    r = max(w / im.width, h / im.height)
    im = im.resize((round(im.width * r), round(im.height * r)), Image.LANCZOS)
    x, y = (im.width - w) // 2, (im.height - h) // 2
    return im.crop((x, y, x + w, y + h))


def fuente(tam, negrita=True):
    for f in ["/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf" if negrita else "/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed.ttf",
              "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"]:
        if os.path.exists(f):
            return ImageFont.truetype(f, tam)
    return ImageFont.load_default()


def degradado(w, h, alto=0.95):
    capa = Image.new("RGBA", (w, h))
    d = ImageDraw.Draw(capa)
    for y in range(h):
        a = int(255 * alto * max(0, (y / h - 0.15) / 0.85) ** 1.2)
        d.line([(0, y), (w, y)], fill=(10, 35, 26, a))
    for x in range(w):
        a = int(150 * max(0, 1 - x / (w * 0.75)))
        d.line([(x, 0), (x, h)], fill=(10, 35, 26, a))
    return capa


def tarjeta(foto, destino, chapa, titulo, sub, url):
    W, H = 1200, 630
    base = recorte(foto, W, H).convert("RGBA")
    base.alpha_composite(degradado(W, H))
    d = ImageDraw.Draw(base)
    f1, f2, f3, f4 = fuente(26), fuente(78), fuente(34, False), fuente(28)
    tw = d.textlength(chapa, font=f1)
    d.rounded_rectangle([60, 230, 60 + tw + 40, 278], 24, fill=(184, 224, 74))
    d.text((80, 237), chapa, font=f1, fill=(15, 61, 46))
    y = 300
    for linea in titulo.split("\n"):
        d.text((58, y), linea, font=f2, fill=(255, 255, 255))
        y += 84
    d.text((60, y + 10), sub, font=f3, fill=(255, 207, 110))
    d.rectangle([0, H - 64, W, H], fill=(243, 165, 59))
    d.text((60, H - 50), url, font=f4, fill=(15, 61, 46))
    marca = "Vibras Positivas HM"
    d.text((W - 60 - d.textlength(marca, font=f4), H - 50), marca, font=f4, fill=(15, 61, 46))
    base.convert("RGB").save(destino, quality=86, optimize=True)
    print("ok", destino)


def icono(foto, nombre, letras, tam):
    im = recorte(foto, tam, tam).convert("RGBA")
    capa = Image.new("RGBA", (tam, tam), (15, 61, 46, 140))
    im.alpha_composite(capa)
    d = ImageDraw.Draw(im)
    f = fuente(int(tam * 0.36))
    w = d.textlength(letras, font=f)
    d.text(((tam - w) / 2, tam * 0.30), letras, font=f, fill=(255, 255, 255))
    d.rectangle([0, int(tam * 0.86), tam, tam], fill=(243, 165, 59))
    im.convert("RGB").save(os.path.join(IMG, nombre), optimize=True)


def main():
    forzar = "--forzar" in sys.argv
    cache = {}
    for clave, archivo in FOTOS.items():
        destino = os.path.join(IMG, clave + ".jpg")
        if os.path.exists(destino) and not forzar:
            cache[clave] = Image.open(destino).convert("RGB")
            continue
        if archivo in cache:
            im = cache[archivo]
        else:
            print("bajando", archivo)
            im = bajar(archivo)
            if im is None:
                print("  NO SE PUDO", archivo)
                continue
            cache[archivo] = im
        im2 = im.copy()
        im2.thumbnail((1200, 1200))
        im2.save(destino, quality=82, optimize=True)
        cache[clave] = im2
        time.sleep(1)
    hero = cache.get("hero1") or next(iter(cache.values()))
    tarjeta(hero, os.path.join(IMG, "og.jpg"), "CICLO II 2026 · 27 OCT – 16 DIC",
            "Vacunadores\ndel Bajo Cauca", "Registro y pedidos de inyectores, repuestos e insumos",
            "vacunadores-asogauca.netlify.app")
    tarjeta(cache.get("hero2", hero), os.path.join(IMG, "og-admin.jpg"), "COORDINACIÓN",
            "Admin Vacunación\nBajo Cauca", "Inventario, pedidos y vacunadores del ciclo",
            "vacunadores-asogauca.netlify.app/admin.html")
    for t in (192, 512):
        icono(hero, f"icono-{t}.png", "VB", t)
        icono(cache.get("hero2", hero), f"icono-admin-{t}.png", "AD", t)


if __name__ == "__main__":
    main()
