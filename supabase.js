const SUPABASE_URL = "https://vjrhrxizhxatlfnnlynm.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqcmhyeGl6aHhhdGxmbm5seW5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4MTU4MzYsImV4cCI6MjA5OTM5MTgzNn0.pLfpY2YED8EcTkeEFNn7LYm1ky4ZFAuMvnDu0BL2ZTE";

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  }
);

// ============================================
// AUTH FUNCTIONS
// ============================================

async function isAdmin() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return false;
  
  const { data, error } = await supabaseClient
    .from('admins')
    .select('role')
    .eq('email', user.email)
    .maybeSingle();
  
  if(error || !data) return false;
  return data.role === 'admin';
}

async function requireAdmin() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    window.location.href = "admin-login.html";
    return false;
  }
  
  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    alert("Access denied. Admin privileges required.");
    window.location.href = "index.html";
    return false;
  }
  return true;
}

async function getCurrentUser() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  return user;
}

async function getCurrentUserProfile() {
  const user = await getCurrentUser();
  if (!user) return null;
  
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();
  
  if (error) return null;
  return data;
}

async function isProfileApproved() {
  const profile = await getCurrentUserProfile();
  if (!profile) return false;
  return profile.approved === true && profile.is_verified === true;
}

async function getProfileById(profileId) {
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', profileId)
    .eq('approved', true)
    .eq('is_verified', true)
    .maybeSingle();
  
  if (error) return null;
  return data;
}

async function getProfileByUserId(userId) {
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .eq('approved', true)
    .eq('is_verified', true)
    .maybeSingle();
  
  if (error) return null;
  return data;
}

// ============================================
// PROFILE FUNCTIONS
// ============================================

async function getApprovedProfiles(filters = {}) {
  let query = supabaseClient
    .from('profiles')
    .select('*')
    .eq('approved', true)
    .eq('is_verified', true);
  
  if (filters.gender) query = query.eq('gender', filters.gender);
  if (filters.country) query = query.eq('country', filters.country);
  if (filters.age) {
    const [min, max] = filters.age.split('-');
    if (max) {
      query = query.gte('age', parseInt(min)).lte('age', parseInt(max));
    } else {
      query = query.gte('age', parseInt(min));
    }
  }
  if (filters.limit) query = query.limit(filters.limit);
  
  const { data, error } = await query.order('created_at', { ascending: false });
  
  if (error) return [];
  return data;
}

async function updateProfile(userId, updates) {
  const { error } = await supabaseClient
    .from('profiles')
    .update(updates)
    .eq('user_id', userId);
  
  if (error) {
    alert('Error updating profile: ' + error.message);
    return false;
  }
  return true;
}

// ============================================
// INTEREST FUNCTIONS
// ============================================

async function sendInterest(receiverId) {
  const user = await getCurrentUser();
  if (!user) {
    alert('Please login to send interest.');
    window.location.href = 'login.html';
    return false;
  }
  
  const { data: existing, error: checkError } = await supabaseClient
    .from('interests')
    .select('id')
    .eq('sender_id', user.id)
    .eq('receiver_id', receiverId)
    .maybeSingle();
  
  if (existing) {
    alert('You already sent interest to this person.');
    return false;
  }
  
  const { error } = await supabaseClient
    .from('interests')
    .insert({
      sender_id: user.id,
      receiver_id: receiverId,
      status: 'pending'
    });
  
  if (error) {
    alert('Error sending interest: ' + error.message);
    return false;
  }
  
  alert('✅ Interest sent! May Allah bless your journey.');
  return true;
}

async function getInterests(userId) {
  const { data, error } = await supabaseClient
    .from('interests')
    .select('*, sender:sender_id(id, name, image), receiver:receiver_id(id, name, image)')
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order('created_at', { ascending: false });
  
  if (error) return [];
  return data;
}

async function respondToInterest(interestId, status) {
  const { error } = await supabaseClient
    .from('interests')
    .update({ status: status })
    .eq('id', interestId);
  
  if (error) {
    alert('Error: ' + error.message);
    return false;
  }
  return true;
}

// ============================================
// MESSAGE FUNCTIONS
// ============================================

async function sendMessage(receiverId, content) {
  const user = await getCurrentUser();
  if (!user) {
    alert('Please login to send message.');
    window.location.href = 'login.html';
    return false;
  }
  
  const { error } = await supabaseClient
    .from('messages')
    .insert({
      sender_id: user.id,
      receiver_id: receiverId,
      content: content,
      is_read: false
    });
  
  if (error) {
    alert('Error sending message: ' + error.message);
    return false;
  }
  return true;
}

async function getMessages(userId1, userId2) {
  const { data, error } = await supabaseClient
    .from('messages')
    .select('*')
    .or(`and(sender_id.eq.${userId1},receiver_id.eq.${userId2}),and(sender_id.eq.${userId2},receiver_id.eq.${userId1})`)
    .order('created_at', { ascending: true });
  
  if (error) return [];
  return data;
}

async function markMessagesAsRead(userId, otherUserId) {
  const { error } = await supabaseClient
    .from('messages')
    .update({ is_read: true })
    .eq('sender_id', otherUserId)
    .eq('receiver_id', userId)
    .eq('is_read', false);
  
  if (error) console.error('Error marking messages as read:', error);
}

async function getConversations(userId) {
  const { data, error } = await supabaseClient
    .from('messages')
    .select('*, sender:sender_id(id, name, image), receiver:receiver_id(id, name, image)')
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order('created_at', { ascending: false });
  
  if (error) return [];
  return data;
}

// ============================================
// SUCCESS STORIES FUNCTIONS
// ============================================

async function getSuccessStories(limit = 3) {
  const { data, error } = await supabaseClient
    .from('success_stories')
    .select('*')
    .eq('approved', true)
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (error) return [];
  return data;
}

// ============================================
// STATS FUNCTIONS
// ============================================

async function getStats() {
  const stats = {};
  
  const { count: profileCount } = await supabaseClient
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('approved', true)
    .eq('is_verified', true);
  stats.profiles = profileCount || 0;
  
  const { count: storyCount } = await supabaseClient
    .from('success_stories')
    .select('*', { count: 'exact', head: true })
    .eq('approved', true);
  stats.stories = storyCount || 0;
  
  const { data: countries } = await supabaseClient
    .from('profiles')
    .select('country')
    .eq('approved', true)
    .eq('is_verified', true);
  
  const uniqueCountries = new Set(countries?.map(p => p.country).filter(Boolean) || []);
  stats.countries = uniqueCountries.size || 0;
  
  return stats;
}

// ============================================
// CONTACT FUNCTIONS
// ============================================

async function sendContactMessage(name, email, subject, message) {
  const { error } = await supabaseClient
    .from('contact_messages')
    .insert({
      name: name,
      email: email,
      subject: subject || null,
      message: message
    });
  
  if (error) {
    alert('Error sending message: ' + error.message);
    return false;
  }
  return true;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function generateSlug(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getAvatarUrl(name, size = 100) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=c8a96e&color=0a2e1a&size=${size}`;
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function formatTime(date) {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getAge(birthDate) {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

// ============================================
// REAL-TIME SUBSCRIPTION HELPERS
// ============================================

function subscribeToMessages(userId, otherUserId, callback) {
  const channel = supabaseClient
    .channel('messages-channel')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `or(and(sender_id.eq.${userId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${userId}))`
    }, callback)
    .subscribe();
  
  return channel;
}

function subscribeToInterests(userId, callback) {
  const channel = supabaseClient
    .channel('interests-channel')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'interests',
      filter: `receiver_id.eq.${userId}`
    }, callback)
    .subscribe();
  
  return channel;
}