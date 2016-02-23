function CPLayer(width, height, name) {
    "use strict";
    
    width = width | 0;
    height = height | 0;
    
    var
        BYTES_PER_PIXEL = 4,
        
        RED_BYTE_OFFSET = 0,
        GREEN_BYTE_OFFSET = 1,
        BLUE_BYTE_OFFSET = 2,
        ALPHA_BYTE_OFFSET = 3,
        
        imageData = new ImageData(width, height),
        
        that = this;
        
    this.width = width;
    this.height = height;
    
    this.name = name || "";
    
    this.data = imageData.data;
    
    this.alpha = 100;
    this.visible = true;
    this.blendMode = CPLayer.LM_NORMAL;
    
    function offsetOfPixel(x, y) {
        return (y * that.width + x) * BYTES_PER_PIXEL;
    }
    
    this.getBounds = function() {
        return new CPRect(0, 0, that.width, that.height);
    };
    
    this.clearAll = function(color) {
        var
            a = (color >> 24) & 0xFF,
            r = (color >> 16) & 0xFF,
            g = (color >> 8) & 0xFF,
            b = color & 0xFF;
        
        for (var i = 0; i < this.width * this.height * BYTES_PER_PIXEL; ) {
            that.data[i++] = r;
            that.data[i++] = g;
            that.data[i++] = b;
            that.data[i++] = a;
        }
    };
    
    this.clearRect = function(rect, color) {
        var
            a = (color >> 24) & 0xFF,
            r = (color >> 16) & 0xFF,
            g = (color >> 8) & 0xFF,
            b = color & 0xFF;
        
        var
            rect = this.getBounds().clip(rect);
            yStride = (this.width - rect.getWidth()) * BYTES_PER_PIXEL,
            
            pixIndex = offsetOfPixel(rect.left, rect.top);
        
        for (var y = rect.top; y < rect.bottom; y++, pixIndex += yStride) {
            for (var x = rect.left; x < rect.right; x++) {
                that.data[pixIndex++] = r;
                that.data[pixIndex++] = g;
                that.data[pixIndex++] = b;
                that.data[pixIndex++] = a;
            }
        }
    };

    // Layer blending functions
    //
    // The FullAlpha versions are the ones that work in all cases
    // others need the bottom layer to be 100% opaque but are faster
    
    function fusionWithMultiply(fusion, rect) {
        rect = that.getBounds().clip(rect);

        var 
            yStride = (that.width - rect.getWidth()) * BYTES_PER_PIXEL,
            pixIndex = offsetOfPixel(rect.left, rect.top);
    
        for (var y = rect.top; y < rect.bottom; y++, pixIndex += yStride) {
            for (var x = rect.left; x < rect.right; x++) {
                var 
                    alpha = (that.data[pixIndex + ALPHA_BYTE_OFFSET] * that.alpha / 100) | 0;
                
                if (alpha > 0) {
                    for (var i = 0; i < 3; i++, pixIndex++) {
                        fusion.data[pixIndex] = (fusion.data[pixIndex] - (that.data[pixIndex] ^ 0xFF) * fusion.data[pixIndex] * alpha / (255 * 255)) | 0;
                    }
                    pixIndex++; // Don't need to update the alpha because it started out as 100%
                } else {
                    pixIndex += BYTES_PER_PIXEL;
                }
            }
        }
    }
    
    function fusionWithNormal(fusion, rect) {
        rect = that.getBounds().clip(rect);
        
        var 
            yStride = (that.width - rect.getWidth()) * BYTES_PER_PIXEL,
            pixIndex = offsetOfPixel(rect.left, rect.top);

        for (var y = rect.top; y < rect.bottom; y++, pixIndex += yStride) {
            for (var x = rect.left; x < rect.right; x++) {
                var 
                    alpha = (that.data[pixIndex + ALPHA_BYTE_OFFSET] * that.alpha / 100) | 0;
                
                if (alpha == 0) {
                    pixIndex += BYTES_PER_PIXEL;
                } else if (alpha == 255) {
                    for (var i = 0; i < BYTES_PER_PIXEL; i++, pixIndex++) {
                        fusion.data[pixIndex] = that.data[pixIndex];
                    }
                } else {
                    var 
                        invAlpha = 255 - alpha;

                    for (var i = 0; i < 3; i++, pixIndex++) {
                        fusion.data[pixIndex] = ((that.data[pixIndex] * alpha + fusion.data[pixIndex] * invAlpha) / 255) | 0;
                    }
                    pixIndex++; // Don't need to update the alpha because it started out as 100%
                }
            }
        }
    }

    // Fusing onto an opaque layer when this layer has alpha set to 100
    function fusionWithNormalNoAlpha(fusion, rect) {
        rect = that.getBounds().clip(rect);
        
        var 
            yStride = (that.width - rect.getWidth()) * BYTES_PER_PIXEL,
            pixIndex = offsetOfPixel(rect.left, rect.top);

        for (var y = rect.top; y < rect.bottom; y++, pixIndex += yStride) {
            for (var x = rect.left; x < rect.right; x++) {
                var 
                    alpha = that.data[pixIndex + ALPHA_BYTE_OFFSET];
                
                if (alpha == 0) {
                    pixIndex += BYTES_PER_PIXEL;
                } else if (alpha == 255) {
                    for (var i = 0; i < BYTES_PER_PIXEL; i++, pixIndex++) {
                        fusion.data[pixIndex] = that.data[pixIndex];
                    }
                } else {
                    var 
                        invAlpha = 255 - alpha;

                    for (var i = 0; i < 3; i++, pixIndex++) {
                        fusion.data[pixIndex] = ((that.data[pixIndex] * alpha + fusion.data[pixIndex] * invAlpha) / 255) | 0;
                    }
                    pixIndex++; // Don't need to update the alpha because it started out as 100%
                }
            }
        }
    }
    
    function fusionWithAdd(fusion, rect) {
        rect = that.getBounds().clip(rect);
        
        var 
            yStride = (that.width - rect.getWidth()) * BYTES_PER_PIXEL,
            pixIndex = offsetOfPixel(rect.left, rect.top);

        for (var y = rect.top; y < rect.bottom; y++, pixIndex += yStride) {
            for (var x = rect.left; x < rect.right; x++) {
                var 
                    alpha = (that.data[pixIndex + ALPHA_BYTE_OFFSET] * that.alpha / 100) | 0;
                
                if (alpha > 0) {
                    for (var i = 0; i < 3; i++, pixIndex++) {
                        fusion.data[pixIndex] = Math.min(255, (fusion.data[pixIndex] + alpha * that.data[pixIndex] / 255) | 0);
                    }
                    pixIndex++; // Don't need to update the alpha because it started out as 100%
                } else {
                    pixIndex += BYTES_PER_PIXEL;
                }
            }
        }
    }
    
    // Normal Alpha Mode
    // C = A*d + B*(1-d) and d = aa / (aa + ab - aa*ab)
    function fusionWithNormalFullAlpha(fusion, rect) {
        rect = that.getBounds().clip(rect);
        
        var
            yStride = (that.width - rect.getWidth()) * BYTES_PER_PIXEL,
            pixIndex = offsetOfPixel(rect.left, rect.top);

        for (var y = rect.top; y < rect.bottom; y++, pixIndex += yStride) {
            for (var x = rect.left; x < rect.right; x++) {
                var 
                    alpha1 = (that.data[pixIndex + ALPHA_BYTE_OFFSET] * that.alpha) / 100,
                    alpha2 = (fusion.data[pixIndex + ALPHA_BYTE_OFFSET] * fusion.alpha) / 100,

                    newAlpha = (alpha1 + alpha2 - alpha1 * alpha2 / 255) | 0;
                
                if (newAlpha > 0) {
                    var 
                        realAlpha = (alpha1 * 255 / newAlpha) | 0,
                        invAlpha = 255 - realAlpha;

                    for (var i = 0; i < 3; i++, pixIndex++) {
                        fusion.data[pixIndex] = ((that.data[pixIndex] * realAlpha + fusion.data[pixIndex] * invAlpha) / 255) | 0;
                    }
                    fusion.data[pixIndex++] = newAlpha;
                } else {
                    pixIndex += BYTES_PER_PIXEL;
                }
            }
        }

        fusion.alpha = 100;
    }
    
    // Multiply Mode
    // C = (A*aa*(1-ab) + B*ab*(1-aa) + A*B*aa*ab) / (aa + ab - aa*ab)

    function fusionWithMultiplyFullAlpha(fusion, rect) {
        rect = that.getBounds().clip(rect);
        
        var
            yStride = (that.width - rect.getWidth()) * BYTES_PER_PIXEL,
            pixIndex = offsetOfPixel(rect.left, rect.top);

        for (var y = rect.top; y < rect.bottom; y++, pixIndex += yStride) {
            for (var x = rect.left; x < rect.right; x++) {
                var 
                    alpha1 = (that.data[pixIndex + ALPHA_BYTE_OFFSET] * that.alpha) / 100,
                    alpha2 = (fusion.data[pixIndex + ALPHA_BYTE_OFFSET] * fusion.alpha) / 100,

                    newAlpha = (alpha1 + alpha2 - alpha1 * alpha2 / 255) | 0;
                
                if (newAlpha > 0) {
                    var 
                        alpha12 = (alpha1 * alpha2 / 255) | 0,
                        alpha1n2 = (alpha1 * (alpha2 ^ 0xFF) / 255) | 0,
                        alphan12 = ((alpha1 ^ 0xff) * alpha2 / 255) | 0;

                    for (var i = 0; i < 3; i++, pixIndex++) {
                        fusion.data[pixIndex] = ((that.data[pixIndex] * alpha1n2 + fusion.data[pixIndex] * alphan12 + that.data[pixIndex]
                                * fusion.data[pixIndex] * alpha12 / 255) / newAlpha) | 0;
                    }
                    fusion.data[pixIndex++] = newAlpha;
                } else {
                    pixIndex += BYTES_PER_PIXEL;
                }
            }
        }
        fusion.alpha = 100;
    }

    // Linear Dodge (Add) Mode
    // C = (aa * A + ab * B) / (aa + ab - aa*ab)

    function fusionWithAddFullAlpha(fusion, rect) {
        rect = that.getBounds().clip(rect);
        
        var
            yStride = (that.width - rect.getWidth()) * BYTES_PER_PIXEL,
            pixIndex = offsetOfPixel(rect.left, rect.top);

        for (var y = rect.top; y < rect.bottom; y++, pixIndex += yStride) {
            for (var x = rect.left; x < rect.right; x++) {
                var 
                    alpha1 = (that.data[pixIndex + ALPHA_BYTE_OFFSET] * that.alpha) / 100,
                    alpha2 = (fusion.data[pixIndex + ALPHA_BYTE_OFFSET] * fusion.alpha) / 100,

                    newAlpha = (alpha1 + alpha2 - alpha1 * alpha2 / 255) | 0;

                if (newAlpha > 0) {

                    /*
                     * // this version seems slower than the Math.min one int r = (alpha2 * (color2 >>> 16 & 0xff) +
                     * alpha1 * (color1 >>> 16 & 0xff)) / newAlpha; r |= ((~((r & 0xffffff00) - 1) >> 16) | r) & 0xff;
                     * int g = (alpha2 * (color2 >>> 8 & 0xff) + alpha1 * (color1 >>> 8 & 0xff)) / newAlpha; g |= ((~((g &
                     * 0xffffff00) - 1) >> 16) | g) & 0xff; int b = (alpha2 * (color2 & 0xff) + alpha1 * (color1 &
                     * 0xff)) / newAlpha; b |= ((~((b & 0xffffff00) - 1) >> 16) | b) & 0xff;
                     */

                    for (var i = 0; i < 3; i++, pixIndex++) {
                        fusion.data[pixIndex] = Math.min(255, ((alpha2 * fusion.data[pixIndex] + alpha1 * that.data[pixIndex]) / newAlpha) | 0);
                    }
                    fusion.data[pixIndex++] = newAlpha;
                } else {
                    pixIndex += BYTES_PER_PIXEL;
                }
            }
        }
        
        fusion.alpha = 100;
    }
    
    // Linear Burn (Sub) Mode
    // C = (aa * A + ab * B - aa*ab ) / (aa + ab - aa*ab)

    function fusionWithSubtractFullAlpha(fusion, rect) {
        rect = that.getBounds().clip(rect);
        
        var
            yStride = (that.width - rect.getWidth()) * BYTES_PER_PIXEL,
            pixIndex = offsetOfPixel(rect.left, rect.top);

        for (var y = rect.top; y < rect.bottom; y++, pixIndex += yStride) {
            for (var x = rect.left; x < rect.right; x++) {
                var 
                    alpha1 = (that.data[pixIndex + ALPHA_BYTE_OFFSET] * that.alpha) / 100,
                    alpha2 = (fusion.data[pixIndex + ALPHA_BYTE_OFFSET] * fusion.alpha) / 100,

                    newAlpha = (alpha1 + alpha2 - alpha1 * alpha2 / 255) | 0;

                if (newAlpha > 0) {
                    var 
                        alpha12 = alpha1 * alpha2;

                    for (var i = 0; i < 3; i++, pixIndex++) {
                        var 
                            channel = (alpha2 * fusion.data[pixIndex] + alpha1 * that.data[pixIndex] - alpha12) / newAlpha;
                        
                        // binary magic to clamp negative values to zero without using a condition
                        fusion.data[pixIndex] = channel & (~r >>> 24); 
                    }
                    fusion.data[pixIndex++] = newAlpha;
                } else {
                    pixIndex += BYTES_PER_PIXEL;
                }
            }
        }
        fusion.alpha = 100;
    }

    // Screen Mode
    // same as Multiply except all color channels are inverted and the result too
    // C = 1 - (((1-A)*aa*(1-ab) + (1-B)*ab*(1-aa) + (1-A)*(1-B)*aa*ab) / (aa + ab - aa*ab))

    function fusionWithScreenFullAlpha(fusion, rect) {
        rect = that.getBounds().clip(rect);
        
        var
            yStride = (that.width - rect.getWidth()) * BYTES_PER_PIXEL,
            pixIndex = offsetOfPixel(rect.left, rect.top);

        for (var y = rect.top; y < rect.bottom; y++, pixIndex += yStride) {
            for (var x = rect.left; x < rect.right; x++) {
                var 
                    alpha1 = ((that.data[pixIndex + ALPHA_BYTE_OFFSET] * that.alpha) / 100) | 0,
                    alpha2 = ((fusion.data[pixIndex + ALPHA_BYTE_OFFSET] * fusion.alpha) / 100) | 0,

                    newAlpha = (alpha1 + alpha2 - alpha1 * alpha2 / 255) | 0;

                if (newAlpha > 0) {
                    var 
                        alpha12 = (alpha1 * alpha2 / 255) | 0,
                        alpha1n2 = (alpha1 * (alpha2 ^ 0xFF) / 255) | 0,
                        alphan12 = ((alpha1 ^ 0xff) * alpha2 / 255) | 0;
                    
                    for (var i = 0; i < 3; i++, pixIndex++) {
                        fusion.data[pixIndex] = 0xFF ^ (
                            (
                                (that.data[pixIndex] ^ 0xFF) * alpha1n2
                                + (fusion.data[pixIndex] ^ 0xFF) * alphan12 
                                + (that.data[pixIndex] ^ 0xFF) * (fusion.data[pixIndex] ^ 0xFF) * alpha12 / 255
                            )
                            / newAlpha
                        );
                    }
                    fusion.data[pixIndex++] = newAlpha;
                } else {
                    pixIndex += BYTES_PER_PIXEL;
                }
            }
        }
        
        fusion.alpha = 100;
    }

    // Lighten Mode
    // if B >= A: C = A*d + B*(1-d) and d = aa * (1-ab) / (aa + ab - aa*ab)
    // if A > B: C = B*d + A*(1-d) and d = ab * (1-aa) / (aa + ab - aa*ab)

    function fusionWithLightenFullAlpha(fusion, rect) {
        rect = that.getBounds().clip(rect);
        
        var
            yStride = (that.width - rect.getWidth()) * BYTES_PER_PIXEL,
            pixIndex = offsetOfPixel(rect.left, rect.top);

        for (var y = rect.top; y < rect.bottom; y++, pixIndex += yStride) {
            for (var x = rect.left; x < rect.right; x++) {
                var 
                    alpha1 = (that.data[pixIndex + ALPHA_BYTE_OFFSET] * that.alpha) / 100,
                    alpha2 = (fusion.data[pixIndex + ALPHA_BYTE_OFFSET] * fusion.alpha) / 100,

                    newAlpha = (alpha1 + alpha2 - alpha1 * alpha2 / 255) | 0;

                if (newAlpha > 0) {
                    var 
                    // This alpha is used when color1 > color2
                        alpha12 = (alpha2 * (alpha1 ^ 0xff) / newAlpha) | 0,
                        invAlpha12 = alpha12 ^ 0xFF,

                    // This alpha is used when color2 > color1
                        alpha21 = (alpha1 * (alpha2 ^ 0xff) / newAlpha) | 0,
                        invAlpha21 = alpha21 ^ 0xFF;

                    for (var i = 0; i < 3; i++, pixIndex++) {
                        var 
                            c1 = that.data[pixIndex],
                            c2 = fusion.data[pixIndex];
                        
                        fusion.data[pixIndex] = (((c2 >= c1) ? (c1 * alpha21 + c2 * invAlpha21) : (c2 * alpha12 + c1 * invAlpha12)) / 255) | 0;
                    }
                    fusion.data[pixIndex++] = newAlpha;
                } else {
                    pixIndex += BYTES_PER_PIXEL;
                }
            }
        }
        fusion.alpha = 100;
    }

    // Darken Mode
    // if B >= A: C = B*d + A*(1-d) and d = ab * (1-aa) / (aa + ab - aa*ab)
    // if A > B: C = A*d + B*(1-d) and d = aa * (1-ab) / (aa + ab - aa*ab)

    function fusionWithDarkenFullAlpha(fusion, rect) {
        rect = that.getBounds().clip(rect);
        
        var
            yStride = (that.width - rect.getWidth()) * BYTES_PER_PIXEL,
            pixIndex = offsetOfPixel(rect.left, rect.top);

        for (var y = rect.top; y < rect.bottom; y++, pixIndex += yStride) {
            for (var x = rect.left; x < rect.right; x++) {
                var 
                    alpha1 = (that.data[pixIndex + ALPHA_BYTE_OFFSET] * that.alpha) / 100,
                    alpha2 = (fusion.data[pixIndex + ALPHA_BYTE_OFFSET] * fusion.alpha) / 100,

                    newAlpha = (alpha1 + alpha2 - alpha1 * alpha2 / 255) | 0;

                if (newAlpha > 0) {
                    var
                        // This alpha is used when color1 > color2
                        alpha12 = (alpha1 * (alpha2 ^ 0xff) / newAlpha) | 0,
                        invAlpha12 = (alpha12 ^ 0xff) | 0,
    
                        // This alpha is used when color2 > color1
                        alpha21 = (alpha2 * (alpha1 ^ 0xff) / newAlpha) | 0,
                        invAlpha21 = (alpha21 ^ 0xff) | 0;

                    for (var i = 0; i < 3; i++, pixIndex++) {
                        var 
                            c1 = that.data[pixIndex],
                            c2 = fusion.data[pixIndex];
                        
                        fusion.data[pixIndex] = (((c2 >= c1) ? (c2 * alpha21 + c1 * invAlpha21) : (c1 * alpha12 + c2 * invAlpha12)) / 255) | 0;
                    }
                    fusion.data[pixIndex++] = newAlpha;
                } else {
                    pixIndex += BYTES_PER_PIXEL;
                }
            }
        }
        fusion.alpha = 100;
    }
    
    // Dodge Mode
    //
    // C = (aa*(1-ab)*A + (1-aa)*ab*B + aa*ab*B/(1-A)) / (aa + ab - aa*ab)

    function fusionWithDodgeFullAlpha(fusion, rect) {
        rect = that.getBounds().clip(rect);
        
        var
            yStride = (that.width - rect.getWidth()) * BYTES_PER_PIXEL,
            pixIndex = offsetOfPixel(rect.left, rect.top);

        for (var y = rect.top; y < rect.bottom; y++, pixIndex += yStride) {
            for (var x = rect.left; x < rect.right; x++) {
                var 
                    alpha1 = ((that.data[pixIndex + ALPHA_BYTE_OFFSET] * that.alpha) / 100) | 0;
                
                if (alpha1 == 0) {
                    pixIndex += BYTES_PER_PIXEL;
                    continue;
                }
                
                var
                    alpha2 = ((fusion.data[pixIndex + ALPHA_BYTE_OFFSET] * fusion.alpha) / 100) | 0,
                    newAlpha = (alpha1 + alpha2 - alpha1 * alpha2 / 255) | 0;
                
                if (newAlpha > 0) {
                    var
                        alpha12 = (alpha1 * alpha2 / 255) | 0,
                        alpha1n2 = (alpha1 * (alpha2 ^ 0xff) / 255) | 0,
                        alphan12 = ((alpha1 ^ 0xff) * alpha2 / 255) | 0;
                    
                    for (var i = 0; i < 3; i++, pixIndex++) {
                        var 
                            color1 = that.data[pixIndex],
                            color2 = fusion.data[pixIndex],
                            invColor1 = color1 ^ 0xFF;
                        
                        fusion.data[pixIndex] = 
                            ((
                                (color1 * alpha1n2) 
                                + (color2 * alphan12) 
                                + alpha12 * (invColor1 == 0 ? 255 : Math.min(255, (255 * color2 / invColor1) | 0))
                            ) / newAlpha) | 0;
                    }
                    fusion.data[pixIndex++] = newAlpha;
                } else {
                    pixIndex += BYTES_PER_PIXEL;
                }
            }
        }
        fusion.alpha = 100;
    }

    // Burn Mode
    //
    // C = (aa*(1-ab)*A + (1-aa)*ab*B + aa*ab*(1-(1-B)/A)) / (aa + ab - aa*ab)

    function fusionWithBurnFullAlpha(fusion, rect) {
        rect = that.getBounds().clip(rect);
        
        var
            yStride = (that.width - rect.getWidth()) * BYTES_PER_PIXEL,
            pixIndex = offsetOfPixel(rect.left, rect.top);

        for (var y = rect.top; y < rect.bottom; y++, pixIndex += yStride) {
            for (var x = rect.left; x < rect.right; x++) {
                var 
                    alpha1 = ((that.data[pixIndex + ALPHA_BYTE_OFFSET] * that.alpha) / 100) | 0;
                
                if (alpha1 == 0) {
                    pixIndex += BYTES_PER_PIXEL;
                    continue;
                }
                
                var
                    alpha2 = ((fusion.data[pixIndex + ALPHA_BYTE_OFFSET] * fusion.alpha) / 100) | 0,
                    newAlpha = (alpha1 + alpha2 - alpha1 * alpha2 / 255) | 0;
                
                if (newAlpha > 0) {
                    var
                        alpha12 = (alpha1 * alpha2 / 255) | 0,
                        alpha1n2 = (alpha1 * (alpha2 ^ 0xff) / 255) | 0;
                        alphan12 = ((alpha1 ^ 0xff) * alpha2 / 255) | 0;

                    for (var i = 0; i < 3; i++, pixIndex++) {
                        var 
                            color1 = that.data[pixIndex],
                            color2 = fusion.data[pixIndex],
                            invColor2 = color2 ^ 0xFF;
                        
                        fusion.data[pixIndex] = 
                            ((
                                color1 * alpha1n2 
                                + color2 * alphan12 
                                + alpha12 * (color1 == 0 ? 0 : Math.min(255, 255 * invColor2 / color1) ^ 0xff)
                            )
                            / newAlpha) | 0;
                    }
                    fusion.data[pixIndex++] = newAlpha;  
                } else {
                    pixIndex += BYTES_PER_PIXEL;
                }
            }
        }
        fusion.alpha = 100;
    }

    // Overlay Mode
    // If B <= 0.5 C = (A*aa*(1-ab) + B*ab*(1-aa) + aa*ab*(2*A*B) / (aa + ab - aa*ab)
    // If B > 0.5 C = (A*aa*(1-ab) + B*ab*(1-aa) + aa*ab*(1 - 2*(1-A)*(1-B)) / (aa + ab - aa*ab)

    function fusionWithOverlayFullAlpha(fusion, rect) {
        rect = that.getBounds().clip(rect);
        
        var
            yStride = (that.width - rect.getWidth()) * BYTES_PER_PIXEL,
            pixIndex = offsetOfPixel(rect.left, rect.top);

        for (var y = rect.top; y < rect.bottom; y++, pixIndex += yStride) {
            for (var x = rect.left; x < rect.right; x++) {
                var 
                    alpha1 = ((that.data[pixIndex + ALPHA_BYTE_OFFSET] * that.alpha) / 100) | 0;
                
                if (alpha1 == 0) {
                    pixIndex += BYTES_PER_PIXEL;
                    continue;
                }
                
                var
                    alpha2 = ((fusion.data[pixIndex + ALPHA_BYTE_OFFSET] * fusion.alpha) / 100) | 0,
                    newAlpha = (alpha1 + alpha2 - alpha1 * alpha2 / 255) | 0;
                
                if (newAlpha > 0) {
                    var
                        alpha12 = (alpha1 * alpha2 / 255) | 0,
                        alpha1n2 = (alpha1 * (alpha2 ^ 0xff) / 255) | 0,
                        alphan12 = ((alpha1 ^ 0xff) * alpha2 / 255) | 0;

                    for (var i = 0; i < 3; i++, pixIndex++) {
                        var 
                            c1 = that.data[pixIndex],
                            c2 = fusion.data[pixIndex];
                        
                        fusion.data[pixIndex] = 
                            ((
                                alpha1n2 * c1 
                                + alphan12 * c2 
                                + (
                                    c2 <= 127
                                        ? (alpha12 * 2 * c1 * c2 / 255)
                                        : (alpha12 * ((2 * (c1 ^ 0xff) * (c2 ^ 0xff) / 255) ^ 0xff))
                                )
                            ) / newAlpha) | 0;
                    }
                    fusion.data[pixIndex++] = newAlpha;
                } else {
                    pixIndex += BYTES_PER_PIXEL;
                }
            }
        }
        fusion.alpha = 100;
    }

    // Hard Light Mode (same as Overlay with A and B swapped)
    // If A <= 0.5 C = (A*aa*(1-ab) + B*ab*(1-aa) + aa*ab*(2*A*B) / (aa + ab - aa*ab)
    // If A > 0.5 C = (A*aa*(1-ab) + B*ab*(1-aa) + aa*ab*(1 - 2*(1-A)*(1-B)) / (aa + ab - aa*ab)

    function fusionWithHardLightFullAlpha(fusion, rect) {
        rect = that.getBounds().clip(rect);
        
        var
            yStride = (that.width - rect.getWidth()) * BYTES_PER_PIXEL,
            pixIndex = offsetOfPixel(rect.left, rect.top);

        for (var y = rect.top; y < rect.bottom; y++, pixIndex += yStride) {
            for (var x = rect.left; x < rect.right; x++) {
                var 
                    alpha1 = ((that.data[pixIndex + ALPHA_BYTE_OFFSET] * that.alpha) / 100) | 0;
                
                if (alpha1 == 0) {
                    pixIndex += BYTES_PER_PIXEL;
                    continue;
                }
                
                var
                    alpha2 = ((fusion.data[pixIndex + ALPHA_BYTE_OFFSET] * fusion.alpha) / 100) | 0,
                    newAlpha = (alpha1 + alpha2 - alpha1 * alpha2 / 255) | 0;
                
                if (newAlpha > 0) {
                    var
                        alpha12 = (alpha1 * alpha2 / 255) | 0,
                        alpha1n2 = (alpha1 * (alpha2 ^ 0xff) / 255) | 0,
                        alphan12 = ((alpha1 ^ 0xff) * alpha2 / 255) | 0;

                    for (var i = 0; i < 3; i++, pixIndex++) {
                        var 
                            c1 = that.data[pixIndex],
                            c2 = fusion.data[pixIndex];
                        
                        fusion.data[pixIndex] = 
                            ((
                                alpha1n2 * c1 
                                + alphan12 * c2 
                                + (
                                    c1 <= 127
                                        ? (alpha12 * 2 * c1 * c2 / 255)
                                        : (alpha12 * ((2 * (c1 ^ 0xff) * (c2 ^ 0xff) / 255) ^ 0xff))
                                )
                            ) / newAlpha) | 0;
                    }
                    fusion.data[pixIndex++] = newAlpha;
                } else {
                    pixIndex += BYTES_PER_PIXEL;
                }
            }
        }
        fusion.alpha = 100;
    }

    // Soft Light Mode
    // A < 0.5 => C = (2*A - 1) * (B - B^2) + B
    // A > 0.5 => C = (2*A - 1) * (sqrt(B) - B) + B

    function fusionWithSoftLightFullAlpha(fusion, rect) {
        rect = that.getBounds().clip(rect);
        
        var
            yStride = (that.width - rect.getWidth()) * BYTES_PER_PIXEL,
            pixIndex = offsetOfPixel(rect.left, rect.top);

        for (var y = rect.top; y < rect.bottom; y++, pixIndex += yStride) {
            for (var x = rect.left; x < rect.right; x++) {
                var 
                    alpha1 = ((that.data[pixIndex + ALPHA_BYTE_OFFSET] * that.alpha) / 100) | 0;
                
                if (alpha1 == 0) {
                    pixIndex += BYTES_PER_PIXEL;
                    continue;
                }
                
                var
                    alpha2 = ((fusion.data[pixIndex + ALPHA_BYTE_OFFSET] * fusion.alpha) / 100) | 0,
                    newAlpha = (alpha1 + alpha2 - alpha1 * alpha2 / 255) | 0;
                
                if (newAlpha > 0) {
                    var
                        alpha12 = (alpha1 * alpha2 / 255) | 0,
                        alpha1n2 = (alpha1 * (alpha2 ^ 0xff) / 255) | 0,
                        alphan12 = ((alpha1 ^ 0xff) * alpha2 / 255) | 0;

                    for (var i = 0; i < 3; i++, pixIndex++) {
                        var 
                            c1 = that.data[pixIndex],
                            c2 = fusion.data[pixIndex];
                        
                        fusion.data[pixIndex] = 
                            ((
                                alpha1n2 * c1 
                                + alphan12 * c2 
                                + (
                                    c1 <= 127
                                        ? alpha12 * ((2 * c1 - 255) * that.softLightLUTSquare[c2] / 255 + c2)
                                        : alpha12 * ((2 * c1 - 255) * that.softLightLUTSquareRoot[c2] / 255 + c2)
                                )
                            ) / newAlpha) | 0;
                    }
                    fusion.data[pixIndex++] = newAlpha;

                } else {
                    pixIndex += BYTES_PER_PIXEL;
                }
            }
        }
        fusion.alpha = 100;
    }

    // Vivid Light Mode
    // A < 0.5 => C = 1 - (1-B) / (2*A)
    // A > 0.5 => C = B / (2*(1-A))

    function fusionWithVividLightFullAlpha(fusion, rect) {
        rect = that.getBounds().clip(rect);
        
        var
            yStride = (that.width - rect.getWidth()) * BYTES_PER_PIXEL,
            pixIndex = offsetOfPixel(rect.left, rect.top);

        for (var y = rect.top; y < rect.bottom; y++, pixIndex += yStride) {
            for (var x = rect.left; x < rect.right; x++) {
                var 
                    alpha1 = ((that.data[pixIndex + ALPHA_BYTE_OFFSET] * that.alpha) / 100) | 0;
                
                if (alpha1 == 0) {
                    pixIndex += BYTES_PER_PIXEL;
                    continue;
                }
                
                var
                    alpha2 = ((fusion.data[pixIndex + ALPHA_BYTE_OFFSET] * fusion.alpha) / 100) | 0,
                    newAlpha = (alpha1 + alpha2 - alpha1 * alpha2 / 255) | 0;
                
                if (newAlpha > 0) {
                    var
                        alpha12 = (alpha1 * alpha2 / 255) | 0,
                        alpha1n2 = (alpha1 * (alpha2 ^ 0xff) / 255) | 0,
                        alphan12 = ((alpha1 ^ 0xff) * alpha2 / 255) | 0;

                    for (var i = 0; i < 3; i++, pixIndex++) {
                        var 
                            c1 = that.data[pixIndex],
                            c2 = fusion.data[pixIndex];
                        
                        fusion.data[pixIndex] = 
                            ((
                                alpha1n2 * c1 
                                + alphan12 * c2 
                                + (
                                    c1 <= 127
                                        ? (alpha12 * ((c1 == 0) ? 0 : 255 - Math.min(255, (255 - c2) * 255 / (2 * c1))))
                                        : (alpha12 * (c1 == 255 ? 255 : Math.min(255, c2 * 255 / (2 * (255 - c1)))))
                                )
                            ) / newAlpha) | 0;
                    }
                    fusion.data[pixIndex++] = newAlpha;
                } else {
                    pixIndex += BYTES_PER_PIXEL;
                }
            }
        }
        fusion.alpha = 100;
    }

    // Linear Light Mode
    // C = B + 2*A -1

    function fusionWithLinearLightFullAlpha(fusion, rect) {
        rect = that.getBounds().clip(rect);
        
        var
            yStride = (that.width - rect.getWidth()) * BYTES_PER_PIXEL,
            pixIndex = offsetOfPixel(rect.left, rect.top);

        for (var y = rect.top; y < rect.bottom; y++, pixIndex += yStride) {
            for (var x = rect.left; x < rect.right; x++) {
                var 
                    alpha1 = ((that.data[pixIndex + ALPHA_BYTE_OFFSET] * that.alpha) / 100) | 0;
                
                if (alpha1 == 0) {
                    pixIndex += BYTES_PER_PIXEL;
                    continue;
                }
                
                var
                    alpha2 = ((fusion.data[pixIndex + ALPHA_BYTE_OFFSET] * fusion.alpha) / 100) | 0,
                    newAlpha = (alpha1 + alpha2 - alpha1 * alpha2 / 255) | 0;
                
                if (newAlpha > 0) {
                    var
                        alpha12 = (alpha1 * alpha2 / 255) | 0,
                        alpha1n2 = (alpha1 * (alpha2 ^ 0xff) / 255) | 0,
                        alphan12 = ((alpha1 ^ 0xff) * alpha2 / 255) | 0;
                        
                    for (var i = 0; i < 3; i++, pixIndex++) {
                        var 
                            c1 = that.data[pixIndex],
                            c2 = fusion.data[pixIndex];
                        
                        fusion.data[pixIndex] = 
                            ((
                                alpha1n2 * c1 
                                + alphan12 * c2 
                                + alpha12 * Math.min(255, Math.max(0, c2 + 2 * c1 - 255))
                            ) / newAlpha) | 0;
                    }
                    fusion.data[pixIndex++] = newAlpha;
                } else {
                    pixIndex += BYTES_PER_PIXEL;
                }
            }
        }
        fusion.alpha = 100;
    }

    // Pin Light Mode
    // B > 2*A => C = 2*A
    // B < 2*A-1 => C = 2*A-1
    // else => C = B

    function fusionWithPinLightFullAlpha(fusion, rect) {
        rect = that.getBounds().clip(rect);
        
        var
            yStride = (that.width - rect.getWidth()) * BYTES_PER_PIXEL,
            pixIndex = offsetOfPixel(rect.left, rect.top);

        for (var y = rect.top; y < rect.bottom; y++, pixIndex += yStride) {
            for (var x = rect.left; x < rect.right; x++) {
                var 
                    alpha1 = ((that.data[pixIndex + ALPHA_BYTE_OFFSET] * that.alpha) / 100) | 0;
                
                if (alpha1 == 0) {
                    pixIndex += BYTES_PER_PIXEL;
                    continue;
                }
                
                var
                    alpha2 = ((fusion.data[pixIndex + ALPHA_BYTE_OFFSET] * fusion.alpha) / 100) | 0,
                    newAlpha = (alpha1 + alpha2 - alpha1 * alpha2 / 255) | 0;
                
                if (newAlpha > 0) {
                    var
                        alpha12 = (alpha1 * alpha2 / 255) | 0,
                        alpha1n2 = (alpha1 * (alpha2 ^ 0xff) / 255) | 0,
                        alphan12 = ((alpha1 ^ 0xff) * alpha2 / 255) | 0;

                    for (var i = 0; i < 3; i++, pixIndex++) {
                        var 
                            c1 = that.data[pixIndex],
                            c2 = fusion.data[pixIndex],
                            c3 = (c2 >= 2 * c1) ? (2 * c1) : (c2 <= 2 * c1 - 255) ? (2 * c1 - 255) : c2;
                        
                        fusion.data[pixIndex] = ((
                            alpha1n2 * c1 
                            + alphan12 * c2 
                            + alpha12 * c3
                        ) / newAlpha) | 0;
                    }
                    fusion.data[pixIndex++] = newAlpha;
                } else {
                    pixIndex += BYTES_PER_PIXEL;
                }
            }
        }
        fusion.alpha = 100;
    }
    
    this.fusionWith = function(fusion, rect) {
        if (this.alpha <= 0) {
            return;
        }
        
        switch (this.blendMode) {
            case CPLayer.LM_NORMAL:
                if (this.alpha >= 100) {
                    fusionWithNormalNoAlpha(fusion, rect);
                } else {
                    fusionWithNormal(fusion, rect);
                }
                break;
            
            case CPLayer.LM_MULTIPLY:
                fusionWithMultiply(fusion, rect);
                break;

            case CPLayer.LM_ADD:
                fusionWithAdd(fusion, rect);
                break;

            case CPLayer.LM_SCREEN:
                fusionWithScreenFullAlpha(fusion, rect);
                break;

            case CPLayer.LM_LIGHTEN:
                fusionWithLightenFullAlpha(fusion, rect);
                break;

            case CPLayer.LM_DARKEN:
                fusionWithDarkenFullAlpha(fusion, rect);
                break;

            case CPLayer.LM_SUBTRACT:
                fusionWithSubtractFullAlpha(fusion, rect);
                break;

            case CPLayer.LM_DODGE:
                fusionWithDodgeFullAlpha(fusion, rect);
                break;

            case CPLayer.LM_BURN:
                fusionWithBurnFullAlpha(fusion, rect);
                break;

            case CPLayer.LM_OVERLAY:
                fusionWithOverlayFullAlpha(fusion, rect);
                break;

            case CPLayer.LM_HARDLIGHT:
                fusionWithHardLightFullAlpha(fusion, rect);
                break;

            case CPLayer.LM_SOFTLIGHT:
                fusionWithSoftLightFullAlpha(fusion, rect);
                break;

            case CPLayer.LM_VIVIDLIGHT:
                fusionWithVividLightFullAlpha(fusion, rect);
                break;

            case CPLayer.LM_LINEARLIGHT:
                fusionWithLinearLightFullAlpha(fusion, rect);
                break;

            case CPLayer.LM_PINLIGHT:
                fusionWithPinLightFullAlpha(fusion, rect);
                break;
        }
    };
    
    this.fusionWithFullAlpha = function(fusion, rect) {
        if (this.alpha <= 0) {
            return;
        }

        switch (this.blendMode) {
            case CPLayer.LM_NORMAL:
                fusionWithNormalFullAlpha(fusion, rect);
                break;
            
            case CPLayer.LM_MULTIPLY:
                fusionWithMultiplyFullAlpha(fusion, rect);
                break;
    
            case CPLayer.LM_ADD:
                fusionWithAddFullAlpha(fusion, rect);
                break;
                
            case CPLayer.LM_SCREEN:
                fusionWithScreenFullAlpha(fusion, rect);
                break;
    
            case CPLayer.LM_LIGHTEN:
                fusionWithLightenFullAlpha(fusion, rect);
                break;
    
            case CPLayer.LM_DARKEN:
                fusionWithDarkenFullAlpha(fusion, rect);
                break;
    
            case CPLayer.LM_SUBTRACT:
                fusionWithSubtractFullAlpha(fusion, rect);
                break;
                
            case CPLayer.LM_DODGE:
                fusionWithDodgeFullAlpha(fusion, rect);
                break;
    
            case CPLayer.LM_BURN:
                fusionWithBurnFullAlpha(fusion, rect);
                break;
    
            case CPLayer.LM_OVERLAY:
                fusionWithOverlayFullAlpha(fusion, rect);
                break;
    
            case CPLayer.LM_HARDLIGHT:
                fusionWithHardLightFullAlpha(fusion, rect);
                break;
    
            case CPLayer.LM_SOFTLIGHT:
                fusionWithSoftLightFullAlpha(fusion, rect);
                break;
    
            case CPLayer.LM_VIVIDLIGHT:
                fusionWithVividLightFullAlpha(fusion, rect);
                break;
    
            case CPLayer.LM_LINEARLIGHT:
                fusionWithLinearLightFullAlpha(fusion, rect);
                break;
    
            case CPLayer.LM_PINLIGHT:
                fusionWithPinLightFullAlpha(fusion, rect);
                break;
        }
    };
    
    // Do we have any semi-transparent pixels in the entire layer?
    this.hasAlpha = function() {
        if (this.alpha != 100) {
            return true;
        }
        
        var 
            pixIndex = ALPHA_BYTE_OFFSET;
        
        for (var y = 0; y < height; y++) {
            var
                alphaAnded = 0xFF;
            
            for (var x = 0; x < this.width; x++, pixIndex += BYTES_PER_PIXEL) {
                alphaAnded &= this.data[pixIndex];
            }
            
            // Only check once per row in order to reduce branching in the inner loop
            if (alphaAnded != 0xFF) {
                return true;
            }
        }
        
        return false;
    };

    // Do we have any semi-transparent pixels in the given rectangle?
    this.hasAlphaInRect = function(rect) {
        if (this.alpha != 100) {
            return true;
        }

        rect = this.getBounds().clip(rect);

        var 
            yStride = (this.width - rect.getWidth()) * BYTES_PER_PIXEL,
            pixIndex = offsetOfPixel(rect.left, rect.top) + ALPHA_BYTE_OFFSET;
        
        for (var y = rect.top; y < rect.bottom; y++, pixIndex += yStride) {
            var
                alphaAnded = 0xFF;
            
            for (var x = rect.left; x < rect.right; x++, pixIndex += BYTES_PER_PIXEL) {
                alphaAnded &= this.data[pixIndex];
            }
            
            // Only check once per row in order to reduce branching in the inner loop
            if (alphaAnded != 0xFF) {
                return true;
            }
        }
        
        return false;
    }
    
    // Return the canvas ImageData that backs this layer
    this.getImageData = function() {
        return imageData;
    };
    
    // Load from an UInt8Array in ARGB byte order
    this.loadFromARGB = function(array) {
        for (var i = 0; i < array.length; i += 4) {
            this.data[i + ALPHA_BYTE_OFFSET] = array[i];
            this.data[i + RED_BYTE_OFFSET] = array[i + 1];
            this.data[i + GREEN_BYTE_OFFSET] = array[i + 2];
            this.data[i + BLUE_BYTE_OFFSET] = array[i + 3];
        }
    };
    
    this.clearAll(0xFFFFFFFF);
};

CPLayer.LM_NORMAL = 0;
CPLayer.LM_MULTIPLY = 1;
CPLayer.LM_ADD = 2;
CPLayer.LM_SCREEN = 3;
CPLayer.LM_LIGHTEN = 4;
CPLayer.LM_DARKEN = 5;
CPLayer.LM_SUBTRACT = 6;
CPLayer.LM_DODGE = 7;
CPLayer.LM_BURN = 8;
CPLayer.LM_OVERLAY = 9;
CPLayer.LM_HARDLIGHT = 10;
CPLayer.LM_SOFTLIGHT = 11;
CPLayer.LM_VIVIDLIGHT = 12;
CPLayer.LM_LINEARLIGHT = 13;
CPLayer.LM_PINLIGHT = 14;

CPLayer.prototype.makeLookUpTables = function() {
    // V - V^2 table
    CPLayer.prototype.softLightLUTSquare = new Array(256);
    
    for (var i = 0; i < 256; i++) {
        var 
            v = i / 255.;
        
        CPLayer.prototype.softLightLUTSquare[i] = ((v - v * v) * 255.) | 0;
    }

    // sqrt(V) - V table
    CPLayer.prototype.softLightLUTSquareRoot = new Array(256);
    for (var i = 0; i < 256; i++) {
        var
            v = i / 255.;
        
        CPLayer.prototype.softLightLUTSquareRoot[i] = ((Math.sqrt(v) - v) * 255.) | 0;
    }
};

CPLayer.prototype.makeLookUpTables();