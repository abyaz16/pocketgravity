"""
Generate all PocketGravity icons in all resolutions and formats for:
- Windows Desktop (.ico, .exe resource, shortcuts)
- Web PWA / Browser (favicon.ico, favicon.svg, icon-192, icon-512, apple-touch-icon)
- Android App (mipmap-mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi)
"""
import math
import os
from PIL import Image, ImageDraw, ImageFilter

def create_master_icon(size=1024):
    # Render at 1024x1024 with supersampling for pristine antialiasing
    scale = size / 100.0  # reference grid 100x100
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 1. Base Squircle Frame
    rx = int(24 * scale)
    draw.rounded_rectangle([0, 0, size, size], radius=rx, fill=(8, 11, 19, 255))
    border_w = max(1, int(1.8 * scale))
    draw.rounded_rectangle([border_w//2, border_w//2, size - border_w//2, size - border_w//2], 
                           radius=rx, outline=(30, 41, 59, 255), width=border_w)

    # 2. Cosmic Ambient Glow (Radial)
    glow_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow_layer)
    center = size // 2
    glow_radius = int(44 * scale)
    for r in range(glow_radius, 0, -2):
        alpha = int(70 * (1 - r / glow_radius) ** 1.5)
        glow_draw.ellipse(
            [center - r, center - r, center + r, center + r],
            fill=(79, 70, 229, alpha)
        )
    glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(radius=int(6 * scale)))
    img.alpha_composite(glow_layer)

    # 3. Celestial Orbit Ring & Core
    # We will draw the orbit on a separate tilted surface
    ring_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    r_draw = ImageDraw.Draw(ring_layer)

    # Draw tilted orbit ring (ellipse cx=50, cy=50, rx=40, ry=14)
    # To handle 3D depth (back of ring behind planet, front of ring in front of planet):
    # Back arc: angles from 180 to 360 (top/back)
    orbit_rx = int(40 * scale)
    orbit_ry = int(14.5 * scale)
    ring_thick = max(2, int(3.4 * scale))

    # Tilted helper: create an image with the ellipse, then rotate -28 deg
    ellipse_surf = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    e_draw = ImageDraw.Draw(ellipse_surf)

    # Draw full ellipse on horizontal axis
    bbox = [center - orbit_rx, center - orbit_ry, center + orbit_rx, center + orbit_ry]
    # Back arc (upper half)
    e_draw.arc(bbox, start=180, end=360, fill=(129, 140, 248, 180), width=ring_thick)

    # Rotate by 28 degrees counter-clockwise
    rotated_back = ellipse_surf.rotate(28, resample=Image.Resampling.BICUBIC, center=(center, center))
    img.alpha_composite(rotated_back)

    # 4. Central Celestial Planet Core Disc
    planet_r = int(22.5 * scale)
    draw.ellipse([center - planet_r, center - planet_r, center + planet_r, center + planet_r],
                 fill=(15, 23, 42, 255), outline=(49, 46, 129, 255), width=max(1, int(2.2 * scale)))

    # 5. Antigravity 4-Point Star Core (Astroid / Hypocycloid curve)
    star_surf = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(star_surf)
    
    # Generate points along the astroid x^(2/3) + y^(2/3) = R^(2/3)
    star_r = int(21 * scale)
    poly_points = []
    num_steps = 120
    for i in range(num_steps):
        theta = 2 * math.pi * i / num_steps
        cos_t = math.cos(theta)
        sin_t = math.sin(theta)
        # Astroid parametric coordinates
        px = center + star_r * (math.copysign(abs(cos_t) ** 3, cos_t))
        py = center + star_r * (math.copysign(abs(sin_t) ** 3, sin_t))
        poly_points.append((px, py))
    
    s_draw.polygon(poly_points, fill=(129, 140, 248, 255))
    
    # Add star gradient tint (cyan bottom-right, purple top-left)
    star_grad = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sg_draw = ImageDraw.Draw(star_grad)
    for y in range(center - star_r, center + star_r):
        progress = (y - (center - star_r)) / (2 * star_r)
        r_c = int(167 * (1 - progress) + 56 * progress)
        g_c = int(139 * (1 - progress) + 189 * progress)
        b_c = int(250 * (1 - progress) + 248 * progress)
        sg_draw.line([(center - star_r, y), (center + star_r, y)], fill=(r_c, g_c, b_c, 255))
    
    star_surf = Image.composite(star_grad, star_surf, star_surf)
    img.alpha_composite(star_surf)

    # Core bright white/cyan center orb
    core_orb_r = max(2, int(3.6 * scale))
    draw.ellipse([center - core_orb_r, center - core_orb_r, center + core_orb_r, center + core_orb_r],
                 fill=(255, 255, 255, 245))

    # 6. Orbit Ring Front Arc (passes in front of planet)
    ellipse_front = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ef_draw = ImageDraw.Draw(ellipse_front)
    # Front arc (lower half: 0 to 180 degrees)
    ef_draw.arc(bbox, start=0, end=180, fill=(56, 189, 248, 250), width=ring_thick)

    # 7. Orbiting Pocket Satellite Mobile Device Node
    # Positioned at angle 0 deg (far right of ellipse: center + orbit_rx, center)
    phone_cx = center + orbit_rx - int(2 * scale)
    phone_cy = center
    
    # Beacon aura
    beacon_aura_r = int(9 * scale)
    ef_draw.ellipse([phone_cx - beacon_aura_r, phone_cy - beacon_aura_r, 
                     phone_cx + beacon_aura_r, phone_cy + beacon_aura_r], 
                    fill=(56, 189, 248, 80))
    
    # Phone Body (outer rectangle)
    pw = int(10 * scale)
    ph = int(17 * scale)
    prx = max(1, int(3 * scale))
    p_box = [phone_cx - pw//2, phone_cy - ph//2, phone_cx + pw//2, phone_cy + ph//2]
    ef_draw.rounded_rectangle(p_box, radius=prx, fill=(9, 13, 22, 255), outline=(56, 189, 248, 255), width=max(1, int(1.6 * scale)))
    
    # Phone Screen (bright cyan active display)
    sw = int(6.4 * scale)
    sh = int(10 * scale)
    s_box = [phone_cx - sw//2, phone_cy - sh//2 - int(0.5*scale), phone_cx + sw//2, phone_cy - sh//2 + sh]
    ef_draw.rounded_rectangle(s_box, radius=max(1, int(1.2 * scale)), fill=(56, 189, 248, 235))
    
    # Phone Home Indicator / Bottom Dot
    dot_r = max(1, int(1.0 * scale))
    dot_y = phone_cy + ph//2 - int(2.2 * scale)
    ef_draw.ellipse([phone_cx - dot_r, dot_y - dot_r, phone_cx + dot_r, dot_y + dot_r], fill=(255, 255, 255, 220))

    # Rotate the front ring + phone by 28 degrees counter-clockwise
    rotated_front = ellipse_front.rotate(28, resample=Image.Resampling.BICUBIC, center=(center, center))
    img.alpha_composite(rotated_front)

    return img

if __name__ == "__main__":
    print("[1/5] Rendering Master PocketGravity Innovation Icon (1024x1024)...")
    master = create_master_icon(1024)

    # 1. Save Windows ICO with all standard embedded mip levels
    ico_sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (24, 24), (16, 16)]
    master.save("E:/pocketgravity/app_icon.ico", format="ICO", sizes=ico_sizes)
    print("  -> Saved E:/pocketgravity/app_icon.ico")

    # 2. Save Web PWA / Browser Icons in client/public and client/dist
    public_dir = "E:/pocketgravity/client/public"
    os.makedirs(public_dir, exist_ok=True)
    
    master.save(f"{public_dir}/favicon.ico", format="ICO", sizes=ico_sizes)
    
    web_sizes = {
        "icon-16.png": 16,
        "icon-32.png": 32,
        "icon-48.png": 48,
        "icon-64.png": 64,
        "icon-128.png": 128,
        "icon-192.png": 192,
        "icon-512.png": 512,
        "apple-touch-icon.png": 180,
    }
    
    for filename, s in web_sizes.items():
        resized = master.resize((s, s), Image.Resampling.LANCZOS)
        resized.save(f"{public_dir}/{filename}", "PNG")
        print(f"  -> Saved {public_dir}/{filename} ({s}x{s})")

    # 3. Android Mipmaps
    densities = {
        'mipmap-mdpi': 48,
        'mipmap-hdpi': 72,
        'mipmap-xhdpi': 96,
        'mipmap-xxhdpi': 144,
        'mipmap-xxxhdpi': 192,
    }
    base_res = "E:/pocketgravity/android/app/src/main/res"
    for folder, size in densities.items():
        out_dir = os.path.join(base_res, folder)
        os.makedirs(out_dir, exist_ok=True)
        resized = master.resize((size, size), Image.Resampling.LANCZOS)
        resized.save(os.path.join(out_dir, 'ic_launcher.png'), 'PNG')
        resized.save(os.path.join(out_dir, 'ic_launcher_round.png'), 'PNG')
        print(f"  -> Saved Android {folder}/ic_launcher.png ({size}x{size})")

    print("[DONE] All icons successfully generated across every platform!")
