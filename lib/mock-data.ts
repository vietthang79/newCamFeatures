export interface Camera {
   id: string;
   name: string;
   ip: string;
   port: number;
   username: string;
   model: string;
   location: string;
   status: "online" | "warning" | "offline" | "pending";
   last_frame_at: Date | null;
   created_at: string;
}

export interface Zone {
   id: string;
   camera_id: string;
   type: "parking_zone" | "entrance_zone" | "no_smoking_zone";
   points: { x: number; y: number }[];
   version: number;
}

export interface Company {
   id: string;
   name: string;
   cameras: Camera[];
}

export const MOCK_CAMERAS: Camera[] = [
   {
      id: "a3f7c2d1-8b4e-4f9a-bc23-1d5e7f8a9b0c",
      name: "Gate A Camera",
      ip: "192.168.1.100",
      port: 80,
      username: "admin",
      model: "MS-C8241-X36PE",
      location: "Gate A",
      status: "online",
      last_frame_at: new Date(Date.now() - 12_000),
      created_at: "2024-01-15",
   },
   {
      id: "b8e1d4f2-3c5f-4a1b-9d72-2e6f0a1b2c3d",
      name: "Lot B North",
      ip: "192.168.1.101",
      port: 80,
      username: "admin",
      model: "MS-C8241-X36PE",
      location: "Lot B",
      status: "warning",
      last_frame_at: new Date(Date.now() - 120_000),
      created_at: "2024-01-16",
   },
   {
      id: "c2a9e5g3-7d8e-4b2c-ae34-3f7g1b2c3d4e",
      name: "Exit Lane 1",
      ip: "192.168.1.102",
      port: 80,
      username: "admin",
      model: "MS-C8241-X36PE",
      location: "Exit",
      status: "offline",
      last_frame_at: new Date(Date.now() - 480_000),
      created_at: "2024-01-17",
   },
   {
      id: "d5f3b7h4-9e0f-4c3d-bf45-4g8h2c3d4e5f",
      name: "Entrance South",
      ip: "192.168.1.103",
      port: 80,
      username: "admin",
      model: "MS-C8241-X36PE",
      location: "Entrance",
      status: "pending",
      last_frame_at: null,
      created_at: "2024-05-05",
   },
   {
      id: "e6g4c8i5-af1g-4d4e-cg56-5h9i3d4e5f6g",
      name: "Lot A South",
      ip: "192.168.1.104",
      port: 80,
      username: "admin",
      model: "MS-C8241-X36PE",
      location: "Lot A",
      status: "online",
      last_frame_at: new Date(Date.now() - 5_000),
      created_at: "2024-02-01",
   },
   {
      id: "f7h5d9j6-bg2h-4e5f-dh67-6i0j4e5f6g7h",
      name: "Loading Bay Camera",
      ip: "192.168.1.105",
      port: 80,
      username: "admin",
      model: "MS-C8241-X36PE",
      location: "Loading Bay",
      status: "online",
      last_frame_at: new Date(Date.now() - 8_000),
      created_at: "2024-02-15",
   },
   {
      id: "g8i6e0k7-ch3i-4f6g-ei78-7j1k5f6g7h8i",
      name: "Roof Level 3",
      ip: "192.168.1.106",
      port: 80,
      username: "admin",
      model: "MS-C8241-X36PE",
      location: "Roof",
      status: "warning",
      last_frame_at: new Date(Date.now() - 200_000),
      created_at: "2024-03-01",
   },
   {
      id: "h9j7f1l8-di4j-4g7h-fj89-8k2l6g7h8i9j",
      name: "Stairwell B",
      ip: "192.168.1.107",
      port: 80,
      username: "admin",
      model: "MS-C8241-X36PE",
      location: "Stairwell",
      status: "offline",
      last_frame_at: new Date(Date.now() - 900_000),
      created_at: "2024-03-20",
   },
];

export const MOCK_ZONES: Zone[] = [
   {
      id: "z1",
      camera_id: "a3f7c2d1-8b4e-4f9a-bc23-1d5e7f8a9b0c",
      type: "parking_zone",
      points: [
         { x: 0.1, y: 0.1 },
         { x: 0.45, y: 0.1 },
         { x: 0.45, y: 0.55 },
         { x: 0.1, y: 0.55 },
      ],
      version: 2,
   },
   {
      id: "z2",
      camera_id: "a3f7c2d1-8b4e-4f9a-bc23-1d5e7f8a9b0c",
      type: "entrance_zone",
      points: [
         { x: 0.6, y: 0.15 },
         { x: 0.92, y: 0.15 },
         { x: 0.76, y: 0.65 },
      ],
      version: 1,
   },
];

export const MOCK_COMPANIES: Company[] = [
   { id: "co1", name: "UK Parking Control", cameras: MOCK_CAMERAS.slice(0, 4) },
   { id: "co2", name: "CityPark Ltd", cameras: MOCK_CAMERAS.slice(2, 6) },
   { id: "co3", name: "SecureSpace Group", cameras: MOCK_CAMERAS.slice(4, 7) },
   { id: "co4", name: "Metro Parking", cameras: MOCK_CAMERAS.slice(5, 8) },
];
