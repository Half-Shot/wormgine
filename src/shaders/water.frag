#version 300 es

precision mediump float;

in vec2 vTextureCoord;
uniform sampler2D uSampler;

out vec4 fragColor;

void main() {
    fragColor = texture(uSampler, vTextureCoord) + vec4(0.1, 0.1, 0.4, 0.95) ;
}

