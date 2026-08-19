// Supabase Configuration
// Using the CDN version of Supabase client

const SUPABASE_URL = 'https://lnyqbjtigekvokwgtadz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxueXFianRpZ2Vrdm9rd2d0YWR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwODEyNTYsImV4cCI6MjEwMjY1NzI1Nn0.HTAkpRkyM0idnqm-CPXNeSHN3IEFecnAcJOlCUymUuY';

// Initialize the Supabase client
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
