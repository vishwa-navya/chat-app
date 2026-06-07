
// Simple typo correction for common medical and general knowledge terms
const typoCorrections: Record<string, string> = {
  // Geography typos
  "captial": "capital",
  "captal": "capital",
  "capitol": "capital",
  "indan": "indian",
  "india": "india",
  "indai": "indian",
  "wheather": "weather",
  "wether": "weather",
  "chenai": "chennai",
  "chennaai": "chennai",
  "mumbay": "mumbai",
  "delhii": "delhi",
  "bangalor": "bangalore",
  "kolkatta": "kolkata",
  
  // Medical terms typos - Anatomy
  "cerebrm": "cerebrum",
  "cerebelum": "cerebellum",
  "medula": "medulla",
  "oblangata": "oblongata",
  "hypothalamus": "hypothalamus",
  "hippocampus": "hippocampus",
  "thallamus": "thalamus",
  "spinalcord": "spinal cord",
  "vertebra": "vertebrae",
  "skelton": "skeleton",
  "sternum": "sternum",
  "ribcage": "rib cage",
  "pelvis": "pelvis",
  "femur": "femur",
  "humrous": "humerus",
  "radious": "radius",
  "ulna": "ulna",
  "phalengies": "phalanges",
  "tibiaa": "tibia",
  "fibulla": "fibula",
  "scapulla": "scapula",
  "clavicel": "clavicle",
  "diaphram": "diaphragm",
  "trachea": "trachea",
  "bronhci": "bronchi",
  "alveoli": "alveoli",
  "larynx": "larynx",
  "pharynx": "pharynx",
  "oesophagus": "esophagus", // UK to US spelling
  "esofagus": "esophagus",
  "esophegus": "esophagus",
  "gallblader": "gallbladder",
  "intestine": "intestine",
  "rectom": "rectum",
  "anus": "anus",
  "uriter": "ureter",
  "urethra": "urethra",
  "blader": "bladder",
  "testicals": "testicles",
  "ovar": "ovary",
  "ovaries": "ovaries",
  "vagaina": "vagina",
  "uteres": "uterus",
  "stomac": "stomach",
  "stomack": "stomach",
  "intestin": "intestine",
  "intestien": "intestine",
  "pancrease": "pancreas",
  "pancrias": "pancreas",
  "livr": "liver",
  "lver": "liver",
  "kidny": "kidney",
  "kidnie": "kidney",
  "hart": "heart",
  "hert": "heart",
  "brane": "brain",
  "brian": "brain",
  "lung": "lungs",
  "longs": "lungs",
  
  // General academic typos
  "funtion": "function",
  "structer": "structure",
  "symtom": "symptom",
  "anotomy": "anatomy",
  "physilogy": "physiology",
  "pathalogy": "pathology",
  "neurons": "neurons",
  "impulses": "impulses",
  "stimulas": "stimulus",
  
  // Common word typos
  "teh": "the",
  "adn": "and",
  "nad": "and",
  "fo": "of",
  "fro": "for",
  "form": "from",
  "whta": "what",
  "waht": "what",
  "hwo": "how",
  "hwat": "what",
  "wich": "which",
  "whcih": "which",
  "recieve": "receive",
  "seperate": "separate",
  "definately": "definitely",
  "occured": "occurred",
  "begining": "beginning",
  "existance": "existence",
  "maintainance": "maintenance",
  
  // Science typos
  "oxigen": "oxygen",
  "oxygn": "oxygen",
  "hidrogen": "hydrogen",
  "hyrogen": "hydrogen",
  "carbn": "carbon",
  "carbom": "carbon",
  "nitrogn": "nitrogen",
  "nitrogin": "nitrogen",
  "calcum": "calcium",
  "calicum": "calcium",
  "protien": "protein",
  "protine": "protein",
  "vitmin": "vitamin",
  "vitamn": "vitamin",
  
  // Body parts typos
  "hed": "head",
  "hnad": "hand",
  "fot": "foot",
  "fet": "feet",
  "bak": "back",
  "nec": "neck",
  "sholder": "shoulder",
  "shulder": "shoulder",
  "elbo": "elbow",
  "kne": "knee",
  "ankel": "ankle",
  "wrist": "wrist",
  "thum": "thumb",
  "figer": "finger",
  "fingr": "finger",
};

// Function to correct common typos
function correctTypos(text: string): string {
  let correctedText = text.toLowerCase();
  
  // Split into words and correct each word
  const words = correctedText.split(' ');
  const correctedWords = words.map(word => {
    // Remove punctuation for matching
    const cleanWord = word.replace(/[^\w]/g, '');
    
    // Check if word needs correction
    if (typoCorrections[cleanWord]) {
      return word.replace(cleanWord, typoCorrections[cleanWord]);
    }
    
    return word;
  });
  
  return correctedWords.join(' ');
}

// Function for fuzzy matching (simple Levenshtein distance)
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

// Function to find closest match
function findClosestMatch(input: string, options: string[]): string | null {
  let closestMatch = null;
  let minDistance = Infinity;
  
  for (const option of options) {
    const distance = levenshteinDistance(input.toLowerCase(), option.toLowerCase());
    if (distance < minDistance && distance <= 2) { // Allow up to 2 character differences
      minDistance = distance;
      closestMatch = option;
    }
  }
  
  return closestMatch;
}

export { correctTypos, findClosestMatch };