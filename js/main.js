class BFile {
  constructor(file, n, url) {
    const dot_index = file.name.lastIndexOf(".");
    this.file = file;
    this.n = n;
    this.size = file.size;
    this.base_name = file.name.substr(0, dot_index);
    this.extension = file.name.substr(dot_index + 1);
    this.fx = this.fy = 0.5;
    this.is_custom_focal = false;
    this.url = url;
  }

  get output_format() {
    if (config.image_format == "jpeg") {
      return { ext: "jpg", format: "image/jpeg" };
    }
    if (config.image_format == "webp") {
      return { ext: "webp", format: "image/webp" };
    }
    // Preserve format
    switch (this.extension.toLowerCase()) {
      case "png":
        return { ext: "png", format: "image/png" };
      case "jpg":
      case "jpeg":
        return { ext: this.extension, format: "image/jpeg" };
      case "webp":
        return { ext: "webp", format: "image/webp" };
    }
  }

  auto_focal(callback) {
    smartcrop
      .crop(this.image, {
        width: Math.min(this.width, this.height),
        height: Math.min(this.width, this.height),
      })
      .then(result => {
        this.fx = result.topCrop.x / this.width;
        this.fy = result.topCrop.y / this.height;
        callback(this.image);
      });
  }
  read(callback) {
    loadImage(this.path, image => {
      this.image = image;
      this.width = image.width;
      this.height = image.height;
      this.auto_focal(callback);
    });
  }

  get path() {
    return this.url ? this.url : this.file;
  }

  get is_jpeg() {
    return ["jpg", "jpeg"].includes(this.extension.toLowerCase());
  }

  get truncated_filename() {
    let filename = this.base_name;
    if (this.base_name.length > 20) {
      filename = this.base_name.substr(0, 15) + ".." + this.base_name.substr(this.base_name.length - 5);
    }
    return filename + "." + this.extension;
  }

  get is_supported() {
    return ["jpg", "jpeg", "png", "webp"].indexOf(this.extension.toLowerCase()) > -1;
  }

  get focal_x() {
    if (this.is_custom_focal || config.auto_focal) {
      return this.fx;
    } else {
      return parseFloat(config.focal_x);
    }
  }

  get focal_y() {
    if (this.is_custom_focal || config.auto_focal) {
      return this.fy;
    } else {
      return parseFloat(config.focal_y);
    }
  }
}

const default_parameters = {
  target_width: 1200,
  target_height: 1200,
  no_resize: false,
  auto_width: false,
  auto_height: false,
  focal_x: 0.5,
  focal_y: 0.5,
  auto_focal: true,
  image_format: "preserve",
  quality_jpeg: 92,
  quality_webp: 50,
  rename: "",
  rename_start: 0,
  border_width: 0,
  border_color: "#000",
  wm_text: "",
  wm_font: "sans-serif",
  wm_size: 18,
  wm_position: "bottom-right",
  wm_margin: 20,
  quality_preset: "high"
};

class BConfig {
  constructor() {
    this.load();
  }

  load(reset = false) {
    let query_params = {};
    let url = document.location.href;
    let parts = url.substr(url.lastIndexOf("?") + 1).split("&");

    for (let p of parts) {
      if (p.indexOf("=") == -1) {
        continue;
      }
      let _tempt = p.split("=");
      query_params[_tempt[0]] = this.clean_value(_tempt[1]);
    }
    if (!reset) {
      let old_url = localStorage.getItem("url");

      if ($.isEmptyObject(query_params) && old_url) {
        history.replaceState(null, null, old_url);
        this.load(reset);
        return;
      }
    }

    for (let k in default_parameters) {
      let v = default_parameters[k];
      if (query_params.hasOwnProperty(k) && !reset) {
        v = query_params[k];
      }
      this[k] = v;

      if (k == "image_format") {
        k = "image_format_" + v;
      }

      let ele = $("#" + k);
      if (!ele.length) {
        continue;
      }
      switch (ele.attr("type").toLowerCase()) {
        case "checkbox":
        case "radio":
          ele.prop("checked", v);
          break;
        case "number":
          ele.val(parseInt(v));
          break;
        default:
          ele.val(v);
      }
    }

    this.update_focal();

    this.toggle_auto_wh("auto_width", "auto_height");
    this.toggle_auto_wh("auto_height", "auto_width");
    this.calculate_ratio();
    this.toggle_no_resize();
    this.toggle_auto_focal();
    this.update_watermark_preview();

    if (reset) {
      birme.preview_visible(true);
      this.update_url();
    }
  }

  update(ele) {
    let name = ele.type == "radio" ? ele.name : ele.id;
    let value;
    if (ele.type == "checkbox") {
      value = $(ele).prop("checked");
    } else {
      value = ele.value;
    }

    if (name == "quality_preset_select") {
      value = ele.options[ele.selectedIndex].value;
    }

    this[name] = value;
    if (name == "auto_width") {
      this.toggle_auto_wh("auto_width", "auto_height");
    } else if (name == "auto_height") {
      this.toggle_auto_wh("auto_height", "auto_width");
    } else if (name == "no_resize") {
      this.toggle_no_resize();
    }

    if (["target_width", "target_height", "auto_width", "auto_height"].includes(name)) {
      if (name == "target_width") {
        this.last_edit = "width";
      } else if (name == "target_height") {
        this.last_edit = "height";
      }
      this.calculate_ratio();
    }

    if (name.indexOf("wm_") == 0) {
      this.update_watermark_preview();
    }

    this.toggle_auto_focal();
    birme.preview_visible(true);
    this.update_url();
  }

  toggle_auto_wh(key, other_key) {
    let input = $("#target" + key.substr(4));

    if (this[key]) {
      input.attr("disabled", "disabled");
    } else {
      input.removeAttr("disabled");
    }
    if (this[key] && this[other_key]) {
      $("#" + other_key).trigger("click");
    }

    if (this.auto_width || this.auto_height) {
      $("body").addClass("auto-size");
    } else {
      $("body").removeClass("auto-size");
    }
  }

  toggle_auto_focal() {
    if (this.auto_width || this.auto_height || this.no_resize) {
      $(".crop-auto, .crop-align").addClass("d-none");
    } else {
      $(".crop-auto").removeClass("d-none");
      if (this.auto_focal) {
        $(".crop-align").addClass("d-none");
      } else {
        $(".crop-align").removeClass("d-none");
      }
    }
  }

  toggle_no_resize() {
    $(".no-resize")
      .siblings()
      .each((index, s) => {
        if (this.no_resize) {
          s.classList.add("d-none");
        } else {
          s.classList.remove("d-none");
        }
      });
  }

  toggle_convert_to_jpeg() {
    for (let f of birme.files) {
      if (f.extension == "png") {
        $(".convert-to-jpeg").removeClass("d-none");
        break;
      } else {
        $(".convert-to-jpeg").addClass("d-none");
      }
    }
  }

  update_focal() {
    let n = this.focal_x / 0.5 + (this.focal_y / 0.5) * 3 + 1;
    const indicator = $(".anchor-points div:last-child");
    const anchor = $(`.anchor-points div:nth-child(${n})`);
    indicator.css({
      top: anchor.css("top"),
      left: anchor.css("left"),
    });
  }

  set_focal(ele) {
    ele = $(ele);
    const n = parseInt(ele.attr("data-n"));
    if (n == 9) {
      return;
    }
    this.focal_x = (n % 3) * 0.5;
    this.focal_y = Math.floor(n / 3) * 0.5;
    const indicator = $(".anchor-points div:last-child");
    indicator.css({ top: ele.css("top"), left: ele.css("left") });
    birme.preview_visible(true);
    this.update_url();
  }

  toggle_panel(ele) {
    $(".panel.show .options-holder").slideUp(300);
    $(".panel.show").removeClass("show");

    $(ele).parent().addClass("show");
    $(ele).next().slideDown(300);
  }

  clean_value(v) {
    v = decodeURIComponent(v);
    if (v.toLowerCase() == "true" || v.toLowerCase() == "false") {
      return v == "true";
    } else {
      return v;
    }
  }

  update_url() {
    let params = [];
    for (let k in default_parameters) {
      let v = this[k];
      if (v != default_parameters[k]) {
        params.push(k + "=" + encodeURIComponent(v));
      }
    }
    history.replaceState(null, null, "?" + params.join("&"));
    localStorage.setItem("url", document.location.search);
  }

  update_ratio() {
    let r = parseFloat($("#ratio_w").val()) / parseFloat($("#ratio_h").val());
    if (this.last_edit == "height") {
      this.target_width = Math.floor(this.target_height * r);
      $("#target_width").val(this.target_width);
    } else {
      this.target_height = Math.floor(this.target_width / r);
      $("#target_height").val(this.target_height);
    }
    this.toggle_auto_focal();
    birme.preview_visible(true);
    this.update_url();
  }

  calculate_ratio() {
    if (this.auto_width || this.auto_height) {
      $(".ratio").addClass("d-none");
      return;
    } else {
      $(".ratio").removeClass("d-none");
    }
    let w = this.target_width;
    let h = this.target_height;

    for (let i = 2; i <= Math.min(w, h); i++) {
      if (w % i == 0 && h % i == 0) {
        w /= i;
        h /= i;
        i = 1;
      }
    }
    $("#ratio_w").val(w);
    $("#ratio_h").val(h);
  }

  map_font(f) {
    return { cursive: "Meddon", serif: "Times New Roman", "sans-serif": "Helvetica, Arial" }[f];
  }
  update_watermark_preview() {
    document.querySelector(".wm-preview .text").style.fontFamily = this.map_font(this.wm_font);
    document.querySelector(".wm-preview .text").style.fontSize = this.wm_size + "px";
    if (this.wm_text) {
      localStorage.removeItem("wm_image");
      document.querySelector(".wm-preview .text").innerHTML = this.wm_text ? this.wm_text : "&copy;2022 All Rights Reserved";
      document.querySelector(".wm-preview .image").innerHTML = "";
    } else {
      document.querySelector(".wm-preview .text").innerHTML = "";
      let image = localStorage.getItem("wm_image");
      if (image) {
        document.querySelector(".wm-preview .image").innerHTML = `<img src="${image}">`;
        this.wm_image = document.querySelector(".wm-preview .image img");
        setTimeout(() => {
          this.wm_image_height = document.querySelector(".wm-preview .image").offsetHeight;
          this.wm_image_width = document.querySelector(".wm-preview .image").offsetWidth;
        }, 100);
      }
    }
  }
  upload_wm(e) {
    let _files = e["dataTransfer"] ? e.dataTransfer.files : e.target.files;
    loadImage(_files[0], image => {
      let canv = document.createElement("canvas");
      let con = canv.getContext("2d");
      canv.width = image.width;
      canv.height = image.height;
      con.drawImage(image, 0, 0);
      localStorage.setItem("wm_image", canv.toDataURL());
      this.wm_text = "";
      document.querySelector("#wm_text").value = "";
      this.update_watermark_preview();
    });
    e.currentTarget.value = "";
  }
}

class Birme {
  constructor() {
    this.files = [];
    this.files_to_add = [];
    this.output_zip = false;
    this.zip = new JSZip();
    this.file_counter = 0;
    this.selected_holder = null;
    this.mask_pattern = new Image();
    this.mask_pattern.src = "static/images/stripes-light.png";
    this.masonry = new Masonry(".tiles-holder", {
      transitionDuration: 0,
    });

    let drop_area = document.querySelector("body");
    drop_area.addEventListener("drop", e => {
      e.stopPropagation();
      e.preventDefault();
      this.add_all(e);
    });
    drop_area.addEventListener("dragover", e => {
      e.stopPropagation();
      e.preventDefault();
    });
    drop_area.addEventListener("dragenter", e => {
      e.stopPropagation();
      e.preventDefault();
    });
    document.querySelector(".tiles-holder").addEventListener("scroll", _ => this.preview_visible(false));
    window.addEventListener("resize", _ => this.preview_visible(true));
    window.addEventListener("mouseup", _ => $(document).off("mousemove"));
  }

  add_all(e) {
    this.files_to_add = [];
    let _files = e["dataTransfer"] ? e.dataTransfer.files : e.target.files;
    for (let i = 0; i < _files.length; i++) {
      let f = new BFile(_files[i], this.files.length);
      if (f.is_supported) {
        this.files.push(f);
        this.files_to_add.push(f);
      }
    }
    config.toggle_convert_to_jpeg();
    $("body").addClass("not-empty");
    this.add_one();
  }

  add_one() {
    let f = this.files_to_add.shift();
    if (!f) {
      setTimeout(() => {
        this.preview_visible(false);
      }, 500);
      return;
    }
    let ele = `
    <div class="tile">
        <div class="image-holder">
              <div class="btn-delete">x</div>
              <canvas class="image-mask"/>
          </div>
          <p>${f.truncated_filename}</p>
      </div>`;
    $(".tiles-holder").append(ele);
    let dom_ele = document.querySelector(".tile:last-child");
    this.masonry.appended(dom_ele);
    let holder = $(dom_ele.querySelector(".image-holder"));
    f.read(img => {
      holder.append(img);
      this.add_one();
    });
    holder.data("file", f);
    holder.on("mousedown", this._image_mousedown);
    holder.children(".btn-delete").on("click", this.remove_one);
    this.masonry.layout();
  }

  remove_one(event) {
    let holder = $(event.target).closest(".image-holder");
    for (let i = 0; i < birme.files.length; i++) {
      if (birme.files[i] == holder.data("file")) {
        birme.files.splice(i, 1);
        break;
      }
    }
    birme.masonry.remove(holder.parent().get(0));
    $(holder).parent().detach();
    if (birme.files.length == 0) {
      $("body").removeClass("not-empty");
    } else {
      birme.masonry.layout();
    }
  }

  preview_visible(force_update = false) {
    this.masonry.layout();
    let tiles = document.querySelectorAll(".tile");
    let holder = document.querySelector(".tiles-holder");
    for (let i = 0; i < tiles.length; i++) {
      if (tiles[i].offsetTop + tiles[i].offsetHeight - holder.scrollTop > 0 && tiles[i].offsetTop - holder.scrollTop < holder.offsetHeight) {
        this.preview_one(tiles[i], this.files[i], force_update);
      }
    }
  }

  preview_one(holder, file, force_update) {
    const mask = holder.querySelector(".image-mask");
    if (!force_update && mask.getAttribute("width") > 0) {
      return;
    }
    var img = holder.querySelector("img");
    const tw = config.target_width;
    const th = config.target_height;
    const fx = file.focal_x;
    const fy = file.focal_y;
    const w = img.offsetWidth;
    const h = img.offsetHeight;
    let nw = w;
    let nh = h;
    if (!(config.auto_width || config.auto_height || config.no_resize)) {
      nw = tw * Math.min(w / tw, h / th);
      nh = th * Math.min(w / tw, h / th);
    }

    mask.width = w;
    mask.height = h;

    const ctx = mask.getContext("2d");
    ctx.fillStyle = ctx.createPattern(this.mask_pattern, "repeat");
    ctx.fillRect(0, 0, w, h);
    ctx.clearRect((w - nw) * fx, (h - nh) * fy, nw, nh);
    if (config.border_width > 0) {
      let border_width = Math.max(2, Math.round((config.border_width * w) / tw));
      ctx.strokeStyle = config.border_color;
      ctx.lineWidth = border_width;
      ctx.strokeRect((w - nw) * fx + border_width / 2, (h - nh) * fy + border_width / 2, nw - border_width, nh - border_width);
    }
  }

  save_all(output_zip) {
    this.show_modal("loading");
    this.output_zip = output_zip;
    // if (this.files.length == 1) {
    // this.output_zip = false;
    // }
    this.zip = new JSZip();
    this.files_to_save = this.files.slice(0);
    this.save_one();
  }

  save_zip(b, filename) {
    this.zip.file(filename, b, {
      base64: true,
    });
    if (this.files_to_save.length == 0) {
      let w = config.auto_width ? "auto" : config.target_width;
      let h = config.auto_height ? "auto" : config.target_height;
      this.zip
        .generateAsync({
          type: "blob",
        })
        .then(content => {
          saveAs(content, `birme-${w}x${h}.zip`);
          this.hide_modal();
        });
    } else {
      this.save_one();
    }
  }

  save_one() {
    if (this.files_to_save.length == 0) {
      this.hide_modal();
      return;
    }
    let f = this.files_to_save.shift();
    loadImage(f.path, img => this.process_image(img, f), { orientation: 1 });
  }

  process_image(img, file) {
    let tw = config.target_width;
    let th = config.target_height;

    const fx = file.focal_x;
    const fy = file.focal_y;

    const iw = img.width;
    const ih = img.height;

    if (config.no_resize) {
      tw = file.width;
      th = file.height;
    } else if (config.auto_width) {
      tw = (img.width * th) / ih;
    } else if (config.auto_height) {
      th = (img.height * tw) / iw;
    }

    let scale = Math.min(iw / tw, ih / th);
    let srcw = tw * scale;
    let srch = th * scale;

    let smoothingEnabled = true;
    let smoothingQuality = "high";

    switch (config.quality_preset) {
      case "low":
      case "medium":
      case "high":
        smoothingEnabled = true;
        smoothingQuality = config.quality_preset;
        break;
      case "disabled":
        smoothingEnabled = false;
        break;
      case "hermite":
        smoothingEnabled = false;
        break;
      default:
        console.error(`FATAL ERROR: Unexpected quality_preset=${config.quality_preset}, try re-selecting your chosen downscale quality preset in settings!`);
        throw Error(`FATAL ERROR: Unexpected quality_preset=${config.quality_preset} :(`);
    }

    // TODO: SUPPORT JPEG/WEBP QUALITY AND BORDER WIDTH SETTING
    if (config.quality_preset == "hermite") {
      let canvasHermite = document.createElement("canvas");
      let ctxHermite = canvasHermite.getContext("2d");
  
      //prepare canvas
      canvasHermite.width = srcw;
      canvasHermite.height = srch;
      
      //crop image based on focal selection (at full resolution)
      ctxHermite.drawImage(img, (iw - srcw) * fx, (ih - srch) * fy, srcw, srch, 0, 0, srcw, srch);
  
      // Use Hermite library for image downscaling
      var HERMITE = new Hermite_class();
      HERMITE.resample_single(canvasHermite, tw, th, true);

      const new_filename = file.base_name + "." + file.output_format.ext;
      if (this.output_zip) {
        canvasHermite.toBlob(b => this.save_zip(b, new_filename), file.output_format.format);
      } else {
        canvasHermite.toBlob(
          b => {
            saveAs(b, new_filename);
            this.save_one();
          },
          file.output_format.format
        );
      }
      return;
    }

    let canvas = document.createElement("canvas");
    canvas.width = tw;
    canvas.height = th;
    let con = canvas.getContext("2d");

    // UTILIZE SEMI-SMART IMAGE DOWNSAMPLING
    con.imageSmoothingEnabled = smoothingEnabled;
    con.imageSmoothingQuality = smoothingQuality;

    let output = file.output_format;
    // Draw a white background for transparent images
    if (output.format == "image/jpeg" && !file.is_jpeg) {
      con.fillStyle = "white";
      con.fillRect(0, 0, tw, th);
    }
    /*******************************************
     * Border
     ******************************************/
    let hw = 0;
    if (config.border_width > 0) {
      con.lineWidth = config.border_width;
      con.strokeStyle = config.border_color;
      hw = config.border_width / 2;
      con.strokeRect(hw, hw, tw - hw * 2, th - hw * 2);
    }
    /*******************************************
     * Image after the border
     ******************************************/
    con.drawImage(img, (iw - srcw) * fx, (ih - srch) * fy, srcw, srch,
                       hw, hw, tw - hw * 2, th - hw * 2);
    if (config.wm_text) {  // ENGAGE WATERMARKING TEXT
      con.font = config.wm_size + "px " + config.map_font(config.wm_font);
      con.textBaseline = "top";
      con.textAlign = "right";
      con.fillStyle = "rgba(255,255,255,0.8)";
      con.shadowOffsetY = 2;
      con.shadowBlur = 5;
      con.shadowColor = "rgba(0,0,0,0.8)";
      con.fillText(config.wm_text, tw - 10, th - config.wm_size - 10);
    } else if (config.wm_image) {  // ENGAGE WATERMARKING IMAGE
      con.drawImage(config.wm_image, tw - config.wm_image_width - 10, th - 10 - config.wm_image_height);
    }
    let new_filename;
    if (config.rename) {
      if (config.rename.indexOf('ORIGINAL-NAME') > -1) {
        new_filename = config.rename.replace('ORIGINAL-NAME', file.base_name);
        if (new_filename.toLowerCase().indexOf('.' + output.ext) == -1) new_filename += '.' + output.ext;
      } else {
        let filename = config.rename.toLowerCase();
        var pattern = new RegExp("x{2,}");
        var result = pattern.exec(filename);
        if (!result) {
          pattern = new RegExp("x+");
          result = pattern.exec(filename);
        }
        if (!result) {
          alert('Sorry the filename pattern cannot be recognized.\nPlease try something like "image-xxx".');
          return;
        }
        let front = filename.substr(0, result.index);
        let end = filename.substr(result.index + result[0].length);
        let index = config.rename_start + "";
        config.rename_start++;
        new_filename = front + index.padStart(result[0].length, "0") + end;
        new_filename = new_filename.replace(/(\.jpe?g)|(\.png)/i, "");
        new_filename += "." + output.ext;
        config.update_url();
        $("#rename_start").val(config.rename_start);
      }
    } else {
      new_filename = file.base_name + "." + output.ext;
    }

    let quality = 92;
    if (output.format == "image/jpeg") {
      quality = config.quality_jpeg / 100;
    } else if (output.format == "image/webp") {
      quality = config.quality_webp / 100;
    } else if (output.format == "image/png") {
      quality = -1;
    }
    if (this.output_zip) {
      if (quality > 0) {
        canvas.toBlob(b => this.save_zip(b, new_filename), output.format, quality);
      } else {
        canvas.toBlob(b => this.save_zip(b, new_filename), output.format);
      }
    } else {
      if (quality > 0) {
        canvas.toBlob(
          b => {
            saveAs(b, new_filename);
            this.save_one();
          },
          output.format,
          quality
        );
      } else {
        canvas.toBlob(
          b => {
            saveAs(b, new_filename);
            this.save_one();
          },
          output.format
        );
      }
    }
  }

  show_section(section, jump = false) {
    let ty = $(".section-" + section).offset().top - $("nav").height() - 13;
    if (jump) {
      $("html,body").scrollTop(ty);
    } else {
      $("html,body").animate({
        scrollTop: ty,
      });
    }
  }
  show_modal(name) {
    $(".modal").addClass("show-" + name);
  }
  hide_modal() {
    $(".modal").removeClass("show-loading");
    $(".modal").removeClass("show-wm");
  }

  _image_mousedown(event) {
    if (config.auto_width || config.auto_height) return;
    let holder = $(event.originalEvent.target);
    if (!holder.hasClass("image-holder")) {
      holder = holder.closest(".image-holder");
    }
    let file = holder.data("file");
    holder.data("x", event.clientX);
    holder.data("y", event.clientY);

    holder.data("fx", file.focal_x);
    holder.data("fy", file.focal_y);
    birme.selected_holder = holder;
    $(document).off("mousemove");
    $(document).on("mousemove", birme._image_mousemove);
  }

  _image_mousemove(event) {
    let holder = birme.selected_holder;
    let file = holder.data("file");

    let x = event.clientX;
    let y = event.clientY;
    let ox = holder.data("x");
    let oy = holder.data("y");

    let fx = holder.data("fx");
    let fy = holder.data("fy");

    let new_fx = fx + ((x - ox) / holder.width()) * 2;
    let new_fy = fy + ((y - oy) / holder.height()) * 2;

    new_fx = Math.max(0, Math.min(1, new_fx));
    new_fy = Math.max(0, Math.min(1, new_fy));

    file.fx = new_fx;
    file.fy = new_fy;
    file.is_custom_focal = true;

    if (new_fx != fx || new_fy != fy) {
      birme.preview_one(holder.get(0), file, true);
    }
  }

  _get_holder_index(holder) {
    let holders = $(".image-holder");
    for (let i = 0; i < holders.length; i++) {
      if (holders[i] == holder) {
        return i;
      }
    }
    return -1;
  }

  _add_test_image(n, ext) {
    var f = new BFile(new File([""], `test-image-${n}.${ext}`), this.files.length, `http://${document.location.host}/static/images/test/${n}.${ext}`);
    this.files.push(f);
    this.files_to_add.push(f);
    this.add_one();
  }
}

let birme = new Birme();
let config = new BConfig();

// Testing code
if (document.location.href.indexOf("8080") > -1) {
  for (var i = 0; i < 1; i++) {
    birme._add_test_image(i + 1, "jpg");
    // birme._add_test_image(i, "webp");
  }
  // birme._add_test_image("2", "png");
  $("body").addClass("not-empty");
  // birme.show_modal("wm");
}
