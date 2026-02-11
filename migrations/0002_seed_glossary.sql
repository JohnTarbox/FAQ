-- Seed glossary categories
INSERT INTO glossary_categories (name, slug) VALUES ('Core System Terms', 'core-system-terms');
INSERT INTO glossary_categories (name, slug) VALUES ('Packet & Routing Terms', 'packet-routing-terms');
INSERT INTO glossary_categories (name, slug) VALUES ('Operational Features', 'operational-features');

-- Core System Terms (category_id will be looked up)
INSERT INTO glossary_terms (term, slug, short_definition, long_definition, abbreviation, acronym_expansion, alternate_names, category_id, status, created_by)
VALUES (
  'APRS-IS',
  'aprs-is',
  'The global internet-based backbone that connects APRS IGates and servers, allowing packets to be shared worldwide beyond local radio range.',
  NULL,
  'APRS-IS',
  'APRS Internet Service',
  NULL,
  (SELECT id FROM glossary_categories WHERE slug = 'core-system-terms'),
  'published',
  'seed@aprs.works'
);

INSERT INTO glossary_terms (term, slug, short_definition, long_definition, abbreviation, acronym_expansion, alternate_names, category_id, status, created_by)
VALUES (
  'Digipeater',
  'digipeater',
  'A "Digital Repeater" that receives a packet and immediately re-transmits it to extend the signal''s range. Modern systems use "New-N" paradigms (like WIDE1-1) to control how many times a packet is repeated.',
  NULL,
  NULL,
  NULL,
  '["Digital Repeater", "Digi"]',
  (SELECT id FROM glossary_categories WHERE slug = 'core-system-terms'),
  'published',
  'seed@aprs.works'
);

INSERT INTO glossary_terms (term, slug, short_definition, long_definition, abbreviation, acronym_expansion, alternate_names, category_id, status, created_by)
VALUES (
  'IGate',
  'igate',
  'A station that acts as a bridge between the local RF (Radio Frequency) network and the APRS-IS. It typically receives packets over the air and "gates" them to the internet.',
  NULL,
  NULL,
  'Internet Gateway',
  NULL,
  (SELECT id FROM glossary_categories WHERE slug = 'core-system-terms'),
  'published',
  'seed@aprs.works'
);

INSERT INTO glossary_terms (term, slug, short_definition, long_definition, abbreviation, acronym_expansion, alternate_names, category_id, status, created_by)
VALUES (
  'TNC',
  'tnc',
  'The hardware or software "modem" that converts digital data into audio tones for the radio and vice versa.',
  NULL,
  'TNC',
  'Terminal Node Controller',
  NULL,
  (SELECT id FROM glossary_categories WHERE slug = 'core-system-terms'),
  'published',
  'seed@aprs.works'
);

-- Packet & Routing Terms
INSERT INTO glossary_terms (term, slug, short_definition, long_definition, abbreviation, acronym_expansion, alternate_names, category_id, status, created_by)
VALUES (
  'Beacon',
  'beacon',
  'A periodic transmission from a station containing its location, status, or other data.',
  NULL,
  NULL,
  NULL,
  NULL,
  (SELECT id FROM glossary_categories WHERE slug = 'packet-routing-terms'),
  'published',
  'seed@aprs.works'
);

INSERT INTO glossary_terms (term, slug, short_definition, long_definition, abbreviation, acronym_expansion, alternate_names, category_id, status, created_by)
VALUES (
  'Mic-E',
  'mic-e',
  'A highly compressed packet format used to reduce transmission time by encoding GPS data into the address fields of a packet.',
  NULL,
  'Mic-E',
  'Mice-encoded',
  '["Mice-encoded"]',
  (SELECT id FROM glossary_categories WHERE slug = 'packet-routing-terms'),
  'published',
  'seed@aprs.works'
);

INSERT INTO glossary_terms (term, slug, short_definition, long_definition, abbreviation, acronym_expansion, alternate_names, category_id, status, created_by)
VALUES (
  'Path',
  'path',
  'The routing instructions in a packet (e.g., WIDE1-1, WIDE2-1) that tell digipeaters how many hops to take.',
  NULL,
  NULL,
  NULL,
  NULL,
  (SELECT id FROM glossary_categories WHERE slug = 'packet-routing-terms'),
  'published',
  'seed@aprs.works'
);

INSERT INTO glossary_terms (term, slug, short_definition, long_definition, abbreviation, acronym_expansion, alternate_names, category_id, status, created_by)
VALUES (
  'SSID',
  'ssid',
  'A numeric suffix added to a callsign (e.g., -9 for a primary mobile, -7 for a handheld) to distinguish between multiple devices owned by the same user.',
  NULL,
  'SSID',
  'Secondary Station Identifier',
  NULL,
  (SELECT id FROM glossary_categories WHERE slug = 'packet-routing-terms'),
  'published',
  'seed@aprs.works'
);

INSERT INTO glossary_terms (term, slug, short_definition, long_definition, abbreviation, acronym_expansion, alternate_names, category_id, status, created_by)
VALUES (
  'ToCall',
  'tocall',
  'The destination address field in an APRS packet, which is usually used to identify the software or hardware device type rather than a specific recipient.',
  NULL,
  NULL,
  NULL,
  NULL,
  (SELECT id FROM glossary_categories WHERE slug = 'packet-routing-terms'),
  'published',
  'seed@aprs.works'
);

-- Operational Features
INSERT INTO glossary_terms (term, slug, short_definition, long_definition, abbreviation, acronym_expansion, alternate_names, category_id, status, created_by)
VALUES (
  'Object',
  'object',
  'A virtual map item (like a meeting location or weather hazard) posted by a station to the network for others to see.',
  NULL,
  NULL,
  NULL,
  NULL,
  (SELECT id FROM glossary_categories WHERE slug = 'operational-features'),
  'published',
  'seed@aprs.works'
);

INSERT INTO glossary_terms (term, slug, short_definition, long_definition, abbreviation, acronym_expansion, alternate_names, category_id, status, created_by)
VALUES (
  'Symbol',
  'symbol',
  'The graphical icon (like a car, house, or ambulance) chosen by a user to represent their station on a map.',
  NULL,
  NULL,
  NULL,
  NULL,
  (SELECT id FROM glossary_categories WHERE slug = 'operational-features'),
  'published',
  'seed@aprs.works'
);

INSERT INTO glossary_terms (term, slug, short_definition, long_definition, abbreviation, acronym_expansion, alternate_names, category_id, status, created_by)
VALUES (
  'Telemetry',
  'telemetry',
  'Data transmissions regarding the status of equipment, such as battery voltage, temperature, or signal strength.',
  NULL,
  NULL,
  NULL,
  NULL,
  (SELECT id FROM glossary_categories WHERE slug = 'operational-features'),
  'published',
  'seed@aprs.works'
);

-- Set up related term relationships
-- IGate <-> APRS-IS (both are internet connectivity concepts)
INSERT INTO term_relationships (term_id, related_term_id) VALUES (
  (SELECT id FROM glossary_terms WHERE slug = 'igate'),
  (SELECT id FROM glossary_terms WHERE slug = 'aprs-is')
);
INSERT INTO term_relationships (term_id, related_term_id) VALUES (
  (SELECT id FROM glossary_terms WHERE slug = 'aprs-is'),
  (SELECT id FROM glossary_terms WHERE slug = 'igate')
);

-- Digipeater <-> Path (digipeaters follow path instructions)
INSERT INTO term_relationships (term_id, related_term_id) VALUES (
  (SELECT id FROM glossary_terms WHERE slug = 'digipeater'),
  (SELECT id FROM glossary_terms WHERE slug = 'path')
);
INSERT INTO term_relationships (term_id, related_term_id) VALUES (
  (SELECT id FROM glossary_terms WHERE slug = 'path'),
  (SELECT id FROM glossary_terms WHERE slug = 'digipeater')
);

-- SSID <-> Beacon (stations identified by SSID send beacons)
INSERT INTO term_relationships (term_id, related_term_id) VALUES (
  (SELECT id FROM glossary_terms WHERE slug = 'ssid'),
  (SELECT id FROM glossary_terms WHERE slug = 'beacon')
);
INSERT INTO term_relationships (term_id, related_term_id) VALUES (
  (SELECT id FROM glossary_terms WHERE slug = 'beacon'),
  (SELECT id FROM glossary_terms WHERE slug = 'ssid')
);

-- Mic-E <-> ToCall (Mic-E encodes data in address fields including ToCall)
INSERT INTO term_relationships (term_id, related_term_id) VALUES (
  (SELECT id FROM glossary_terms WHERE slug = 'mic-e'),
  (SELECT id FROM glossary_terms WHERE slug = 'tocall')
);
INSERT INTO term_relationships (term_id, related_term_id) VALUES (
  (SELECT id FROM glossary_terms WHERE slug = 'tocall'),
  (SELECT id FROM glossary_terms WHERE slug = 'mic-e')
);
