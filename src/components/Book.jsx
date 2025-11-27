import { useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useAtom } from "jotai";
import { easing } from "maath";
import { useRef } from "react";
import {
  MeshStandardMaterial,
  SRGBColorSpace,
} from "three";
import { degToRad } from "three/src/math/MathUtils.js";
import { coverAtom, bookOpenAtom, covers } from "./UI";

// Book dimensions based on actual trim size: 8.5" (height) × 5.75" (width) × 0.688" (spine depth)
// The book opens along the 8.5" edge - spine runs along the 8.5" dimension
// Scaling down to fit in scene (1 unit = 1 inch scaled to 0.2)
const BOOK_HEIGHT = 1.7; // 8.5" * 0.2 (vertical dimension - spine runs along this)
const BOOK_WIDTH = 1.15; // 5.75" * 0.2 (horizontal width of each cover)
const SPINE_DEPTH = 0.1376; // 0.688" * 0.2 (thickness of the spine)
const COVER_THICKNESS = 0.008; // Thin cover material

// Cover image has front (5.75") + spine (0.688") + back (5.75") = 12.188" total width
// But the HEIGHT of the cover image is 8.75" (matches the 8.5" book height + 0.25" bleed)
const COVER_TOTAL_WIDTH = 2.4376; // 12.188" * 0.2
const COVER_IMAGE_HEIGHT = 1.75; // 8.75" * 0.2

const easingFactor = 0.08;

// Preload all cover textures
covers.forEach((cover) => {
  useTexture.preload(`/covers/${cover}`);
});

export const Book = ({ ...props }) => {
  const [selectedCover] = useAtom(coverAtom);
  const [bookOpen] = useAtom(bookOpenAtom);
  
  const frontCoverRef = useRef();
  const backCoverRef = useRef();
  const spineRef = useRef();

  // Load the selected cover texture
  const coverTexture = useTexture(`/covers/${covers[selectedCover]}`);
  coverTexture.colorSpace = SRGBColorSpace;

  // Clone textures for each surface with proper UV mapping
  const frontTexture = coverTexture.clone();
  const spineTexture = coverTexture.clone();
  const backTexture = coverTexture.clone();

  // Calculate UV mapping for wraparound texture with bleed adjustment
  // Cover image: 12.188" total (5.75" front + 0.688" spine + 5.75" back) × 8.75" height
  // Bleed: 0.125" to remove from outer edges only
  
  const BLEED_HORIZONTAL = 0.125 / 12.188; // ~0.01026 in UV space
  const BLEED_VERTICAL = 0.125 / 8.75;     // ~0.01429 in UV space
  
  // Front cover: remove bleed from LEFT (outer edge), TOP, and BOTTOM
  const frontWidth = 5.75 / 12.188;
  const frontWidthTrimmed = (5.75 - 0.125) / 12.188; // Remove 0.125" from left
  frontTexture.repeat.set(frontWidthTrimmed, 1 - 2 * BLEED_VERTICAL);
  frontTexture.offset.set(BLEED_HORIZONTAL, BLEED_VERTICAL);
  frontTexture.needsUpdate = true;

  // Spine: remove bleed from TOP and BOTTOM only (not left/right - connects to covers)
  const spineWidth = 0.688 / 12.188;
  spineTexture.repeat.set(spineWidth, 1 - 2 * BLEED_VERTICAL);
  spineTexture.offset.set(frontWidth, BLEED_VERTICAL);
  spineTexture.needsUpdate = true;

  // Back cover: remove bleed from RIGHT (outer edge), TOP, and BOTTOM
  const backWidthTrimmed = (5.75 - 0.125) / 12.188; // Remove 0.125" from right
  backTexture.repeat.set(backWidthTrimmed, 1 - 2 * BLEED_VERTICAL);
  backTexture.offset.set(frontWidth + spineWidth, BLEED_VERTICAL);
  backTexture.needsUpdate = true;

  // Animate book opening/closing
  // Spine runs along Y axis (vertical), covers rotate around Y axis
  useFrame((_, delta) => {
    const targetAngle = bookOpen ? degToRad(120) : 0;
    
    // Smooth rotation for front and back covers around Y axis (spine hinge)
    if (frontCoverRef.current) {
      easing.dampAngle(
        frontCoverRef.current.rotation,
        "y",
        bookOpen ? targetAngle / 2 : 0,
        easingFactor,
        delta
      );
    }

    if (backCoverRef.current) {
      easing.dampAngle(
        backCoverRef.current.rotation,
        "y",
        bookOpen ? -targetAngle / 2 : 0,
        easingFactor,
        delta
      );
    }
  });

  return (
    <group {...props}>
      {/* Spine - runs along the Y axis (8.5" / 1.7 units tall) at the binding edge */}
      <mesh ref={spineRef} castShadow receiveShadow position-x={0}>
        <boxGeometry args={[COVER_THICKNESS, BOOK_HEIGHT, SPINE_DEPTH]} />
        {/* Material array: [+X, -X, +Y, -Y, +Z (front-facing), -Z (back-facing)] */}
        <meshStandardMaterial 
          attach="material-0"
          map={spineTexture}
        />
        <meshStandardMaterial 
          attach="material-1"
          map={spineTexture}
        />
        <meshStandardMaterial 
          attach="material-2"
          map={spineTexture}
        />
        <meshStandardMaterial 
          attach="material-3"
          map={spineTexture}
        />
        <meshStandardMaterial 
          attach="material-4"
          color="#000000"
        />
        <meshStandardMaterial 
          attach="material-5"
          color="#000000"
        />
      </mesh>

      {/* Front Cover - pivot at spine (x=0), extends in -X direction, positioned at +Z */}
      <group ref={frontCoverRef} position={[0, 0, SPINE_DEPTH / 2]}>
        <mesh castShadow receiveShadow position-x={-BOOK_WIDTH / 2}>
          <boxGeometry args={[BOOK_WIDTH, BOOK_HEIGHT, COVER_THICKNESS]} />
          <meshStandardMaterial map={frontTexture} />
        </mesh>
        
        {/* Front pages attached to front cover - INSIDE the book */}
        <mesh position={[-BOOK_WIDTH / 2, 0, -(SPINE_DEPTH / 4 + COVER_THICKNESS / 2)]}>
          <boxGeometry args={[BOOK_WIDTH * 0.98, BOOK_HEIGHT * 0.98, SPINE_DEPTH / 2 - COVER_THICKNESS]} />
          <meshStandardMaterial color="#f5f5f5" />
        </mesh>
    </group>

      {/* Back Cover - pivot at spine (x=0), extends in -X direction, positioned at -Z */}
      <group ref={backCoverRef} position={[0, 0, -SPINE_DEPTH / 2]}>
        <mesh castShadow receiveShadow position-x={-BOOK_WIDTH / 2}>
          <boxGeometry args={[BOOK_WIDTH, BOOK_HEIGHT, COVER_THICKNESS]} />
          <meshStandardMaterial map={backTexture} />
        </mesh>
        
        {/* Back pages attached to back cover - INSIDE the book */}
        <mesh position={[-BOOK_WIDTH / 2, 0, (SPINE_DEPTH / 4 + COVER_THICKNESS / 2)]}>
          <boxGeometry args={[BOOK_WIDTH * 0.98, BOOK_HEIGHT * 0.98, SPINE_DEPTH / 2 - COVER_THICKNESS]} />
          <meshStandardMaterial color="#f5f5f5" />
        </mesh>
      </group>
    </group>
  );
};
