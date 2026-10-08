import cv2
import numpy as np


# --------------------------------------------------
# PART 1: PHOTO QUALITY CHECK
# --------------------------------------------------

def check_photo_quality(image):

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    blur = cv2.Laplacian(
        gray,
        cv2.CV_64F
    ).var()

    brightness = gray.mean()
    contrast = gray.std()

    height, width = gray.shape

    issues = []

    # Image size
    if width < 400 or height < 400:
        issues.append("image too small")

    # Brightness
    if brightness < 50:
        issues.append("too dark")

    if brightness > 220:
        issues.append("too bright")

    # Contrast
    if contrast < 25:
        issues.append("low contrast")

    # Blur
    if blur < 20:
        issues.append("blurry")

    # Quality score
    quality_score = max(
        0,
        100 - (len(issues) * 20)
    )

    return {
        "quality_score": quality_score,
        "issues": issues,
        "blur": blur,
        "brightness": brightness,
        "contrast": contrast,
        "width": width,
        "height": height
    }


# --------------------------------------------------
# PART 2: FIND WOUND
# --------------------------------------------------

def find_wound(image):

    # Convert BGR to LAB
    lab = cv2.cvtColor(
        image,
        cv2.COLOR_BGR2LAB
    )

    # Extract Lab "a" channel
    a_channel = lab[:, :, 1]

    height, width = a_channel.shape

    # Use middle portion of image
    # to estimate normal skin color
    y1 = int(height * 0.15)
    y2 = int(height * 0.85)

    x1 = int(width * 0.15)
    x2 = int(width * 0.85)

    center_region = a_channel[
        y1:y2,
        x1:x2
    ]

    skin_a = np.median(center_region)

    # Preliminary redness threshold
    # Tuned experimentally for prototype
    threshold = skin_a + 18

    # Create binary mask
    mask = np.zeros_like(
        a_channel,
        dtype=np.uint8
    )

    mask[a_channel > threshold] = 255

    # Morphological cleaning
    kernel = np.ones(
        (5, 5),
        np.uint8
    )

    # Remove small noise
    mask = cv2.morphologyEx(
        mask,
        cv2.MORPH_OPEN,
        kernel
    )

    # Fill small gaps
    mask = cv2.morphologyEx(
        mask,
        cv2.MORPH_CLOSE,
        kernel
    )

    # Find wound regions
    contours, _ = cv2.findContours(
        mask,
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE
    )

    # Final empty mask
    final_mask = np.zeros_like(mask)

    if contours:

        # Select largest region
        largest_contour = max(
            contours,
            key=cv2.contourArea
        )

        cv2.drawContours(
            final_mask,
            [largest_contour],
            -1,
            255,
            -1
        )

    return final_mask, skin_a, threshold


# --------------------------------------------------
# PART 3: WOUND VISIBILITY CHECK
# --------------------------------------------------

def check_wound_visibility(mask):

    height, width = mask.shape

    total_pixels = height * width

    wound_pixels = cv2.countNonZero(mask)

    issues = []

    # Wound percentage of entire image
    wound_percentage = (
        wound_pixels /
        total_pixels
    ) * 100

    # Too small
    if wound_percentage < 1:
        issues.append(
            "wound too small in photo"
        )

    # Check image edges
    top_edge = np.any(
        mask[0, :] > 0
    )

    bottom_edge = np.any(
        mask[-1, :] > 0
    )

    left_edge = np.any(
        mask[:, 0] > 0
    )

    right_edge = np.any(
        mask[:, -1] > 0
    )

    if (
        top_edge
        or bottom_edge
        or left_edge
        or right_edge
    ):
        issues.append(
            "wound touches photo edge"
        )

    return issues, wound_percentage


# --------------------------------------------------
# PART 4: REDNESS MEASUREMENT
# --------------------------------------------------

def calculate_redness(image, mask):

    # Convert to LAB
    lab = cv2.cvtColor(
        image,
        cv2.COLOR_BGR2LAB
    )

    # Extract "a" channel
    a_channel = lab[:, :, 1]

    # Pixels inside wound
    wound_pixels = a_channel[
        mask > 0
    ]

    if len(wound_pixels) == 0:
        return 0, 0, 0

    # Average wound redness
    wound_a = np.mean(
        wound_pixels
    )

    # Create larger wound region
    kernel = np.ones(
        (15, 15),
        np.uint8
    )

    expanded_mask = cv2.dilate(
        mask,
        kernel,
        iterations=1
    )

    # Skin ring = expanded region - wound
    skin_ring = cv2.subtract(
        expanded_mask,
        mask
    )

    # Pixels in skin ring
    skin_pixels = a_channel[
        skin_ring > 0
    ]

    if len(skin_pixels) == 0:
        return wound_a, 0, 0

    # Average surrounding skin redness
    skin_ring_a = np.mean(
        skin_pixels
    )

    # Difference
    redness = (
        wound_a -
        skin_ring_a
    )

    return (
        wound_a,
        skin_ring_a,
        redness
    )


# --------------------------------------------------
# MAIN PIPELINE
# --------------------------------------------------

image = cv2.imread(
    "test_wound.jpg"
)

if image is None:
    print(
        "Could not load test_wound.jpg"
    )
    exit()


# --------------------------------------------------
# 1. PHOTO QUALITY
# --------------------------------------------------

quality = check_photo_quality(
    image
)

print("Photo quality:")
print(quality)


# --------------------------------------------------
# 2. FIND WOUND
# --------------------------------------------------

mask, skin_a, threshold = find_wound(
    image
)

print(
    "\nEstimated skin a value:",
    skin_a
)

print(
    "Redness threshold:",
    threshold
)


# --------------------------------------------------
# 3. SAVE WOUND MASK
# --------------------------------------------------

mask_path = "wound_mask.png"

cv2.imwrite(
    mask_path,
    mask
)

print(
    "Wound mask saved as",
    mask_path
)


# --------------------------------------------------
# 4. WOUND VISIBILITY
# --------------------------------------------------

visibility_issues, wound_percentage = (
    check_wound_visibility(mask)
)

print(
    "\nWound visibility:"
)

print(
    "Wound area percentage:",
    wound_percentage
)

print(
    "Visibility issues:",
    visibility_issues
)


# --------------------------------------------------
# 5. WOUND AREA
# --------------------------------------------------

area_px = cv2.countNonZero(
    mask
)

print(
    "\nWound area:"
)

print(
    "Area:",
    area_px,
    "pixels"
)


# --------------------------------------------------
# 6. WOUND PERIMETER
# --------------------------------------------------

contours, _ = cv2.findContours(
    mask,
    cv2.RETR_EXTERNAL,
    cv2.CHAIN_APPROX_SIMPLE
)

perimeter_px = 0

if contours:

    largest_contour = max(
        contours,
        key=cv2.contourArea
    )

    perimeter_px = cv2.arcLength(
        largest_contour,
        True
    )

print(
    "\nWound perimeter:"
)

print(
    "Perimeter:",
    perimeter_px,
    "pixels"
)


# --------------------------------------------------
# 7. WOUND REDNESS
# --------------------------------------------------

wound_a, skin_ring_a, redness = (
    calculate_redness(
        image,
        mask
    )
)

print(
    "\nWound redness:"
)

print(
    "Average wound a value:",
    wound_a
)

print(
    "Average skin ring a value:",
    skin_ring_a
)

print(
    "Redness:",
    redness
)


# --------------------------------------------------
# 8. FINAL HANDOFF DATA
# --------------------------------------------------

final_output = {

    "quality_score":
        quality["quality_score"],

    "issues":
        quality["issues"] + visibility_issues,

    "area_px":
        area_px,

    "perimeter_px":
        perimeter_px,

    "redness":
        redness,

    "mask_path":
        mask_path
}


# --------------------------------------------------
# FINAL RESULT
# --------------------------------------------------

print(
    "\n=============================="
)

print(
    "FINAL HANDOFF TO PERSON 3"
)

print(
    "=============================="
)

print(final_output)