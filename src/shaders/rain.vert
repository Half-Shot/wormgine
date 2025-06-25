in vec2 aPosition;
in vec2 aUV;
in vec3 aPositionOffset;

out vec2 vUV;

uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
uniform float time;


void main() {
    vec2 pos = (aPosition) * vec2(sin(time + aPositionOffset.z) , 1);

    mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
    vec4 initialPos = vec4((mvp * vec3(pos + aPositionOffset.xy, 1.0)).xy, 1.0, 1.0);

    gl_Position = initialPos;
    vUV = aUV;
}