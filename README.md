# -> [Demo Site](https://storage.googleapis.com/birme-sd-variant/index.html?target_width=512&target_height=512) <-

# Birme Variant for Stable Diffusion
When training Stable Diffusion (or other generative image models) we need high quality and cropped training images at 512x512.  Birme is the best tool for doing this quickly, and with the help of [smartcrop.js](https://github.com/jwagner/smartcrop.js/) it's truly a powerful tool for batch cropping images.

## Local Install
Clone the repository and open index.html in your favorite browser (excluding Firefox).  Feel free to bookmark!
```bash
git clone https://github.com/livelifebythecode/birme-sd-variant.git
cd birme-sd-variant
python -m webbrowser index.html  # or simply open the index.html file
```

## Problem
Birme restricts the users ability to choose what smoothing is applied which can result in a lower quality cropped image.

In the Birme code, notice the line `con.imageSmoothingQuality = "medium";` harcodes the smoothing quality when we crop the image.
```js
process_image(img, file) {
    ...
    let canvas = document.createElement("canvas");
    canvas.width = tw;
    canvas.height = th;
    let con = canvas.getContext("2d");
    con.imageSmoothingEnabled = true;
    con.imageSmoothingQuality = "medium";
    ...
}
```
(sourced on 10-14-22: [line #627](https://www.birme.net/static/js/scripts-323dd.js?953e6bb6))

## Solution
Select the desired smoothing quality in the "Image Format / Quality" settings
![Image of the Quality Preset dropdown box in the "Image Format / Quality settings](https://i.imgur.com/j2Uh1KJ.png)

## Results
TODO: Show comparison of 'Medium', 'High', and 'Hermite' quality presets
High works better on landscape/subjects typically, where as Medium is better at smoothing close up text.

## Limitations
- 🦊 FIREFOX NOT SUPPORTED - [supported browsers](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/imageSmoothingQuality#browser_compatibility)

## Authors
- [Birme Author, support them](https://www.birme.net/)
- Small feature written by me

## Extra
The Hermite quality option uses the [Hermite resize library](https://github.com/viliusle/Hermite-resize) so you can experiment with what gives you the best quality image for your source images.