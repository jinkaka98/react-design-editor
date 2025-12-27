// Video Compositing Shader with Aspect Ratio Handling
// Uses "fit" mode: video is scaled to fit inside canvas, centered, with black bars

// Transform uniform
// videoRect: x=startX, y=startY, z=width, w=height (all in 0-1 normalized coords)
struct Transform {
    videoRect: vec4<f32>,  // x, y, width, height in normalized canvas space
}

@group(0) @binding(0) var mySampler: sampler;
@group(0) @binding(1) var myTexture: texture_external;
@group(0) @binding(2) var<uniform> transform: Transform;

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) texCoord: vec2<f32>,
}

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    // Full-screen quad vertices
    var pos = array<vec2<f32>, 4>(
        vec2<f32>(-1.0, -1.0),  // Bottom-left
        vec2<f32>(1.0, -1.0),   // Bottom-right
        vec2<f32>(-1.0, 1.0),   // Top-left
        vec2<f32>(1.0, 1.0),    // Top-right
    );
    
    // Texture coordinates (standard, Y=0 at top)
    var uv = array<vec2<f32>, 4>(
        vec2<f32>(0.0, 1.0),  // bottom-left of screen
        vec2<f32>(1.0, 1.0),  // bottom-right
        vec2<f32>(0.0, 0.0),  // top-left
        vec2<f32>(1.0, 0.0),  // top-right
    );
    
    var output: VertexOutput;
    output.position = vec4<f32>(pos[vertexIndex], 0.0, 1.0);
    output.texCoord = uv[vertexIndex];
    return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    let canvas_uv = input.texCoord;
    
    // Video rectangle in canvas space
    let videoX = transform.videoRect.x;
    let videoY = transform.videoRect.y;
    let videoW = transform.videoRect.z;
    let videoH = transform.videoRect.w;
    
    // Check if this pixel is inside the video rectangle
    if (canvas_uv.x < videoX || canvas_uv.x > videoX + videoW ||
        canvas_uv.y < videoY || canvas_uv.y > videoY + videoH) {
        // Outside video area - return black
        return vec4<f32>(0.0, 0.0, 0.0, 1.0);
    }
    
    // Map canvas UV to video UV (0-1 within video)
    let video_uv = vec2<f32>(
        (canvas_uv.x - videoX) / videoW,
        (canvas_uv.y - videoY) / videoH
    );
    
    // Sample video texture
    return textureSampleBaseClampToEdge(myTexture, mySampler, video_uv);
}
