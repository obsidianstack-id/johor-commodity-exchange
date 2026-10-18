useEffect(() => {
  const client = supabase;

  if (!client) {
    setSessionReady(true);
    return;
  }

  let mounted = true;

  const checkAdmin = async (userId: string) => {
    try {
      const { data, error } = await client
        .from('profiles')
        .select('is_admin')
        .eq('id', userId)
        .maybeSingle();

      if (!mounted) return;

      if (error) {
        console.error('Gagal memeriksa hak admin:', error.message);
        setIsAdmin(false);
      } else {
        setIsAdmin(Boolean(data?.is_admin));
      }

      setSessionReady(true);
    } catch (error) {
      if (!mounted) return;

      console.error('Gagal memeriksa sesi admin:', error);
      setIsAdmin(false);
      setSessionReady(true);
    }
  };

  const initializeSession = async () => {
    try {
      const {
        data: { session },
        error,
      } = await client.auth.getSession();

      if (!mounted) return;

      if (error) {
        console.error('Gagal mengambil sesi:', error.message);
        setUserId(null);
        setIsAdmin(false);
        setSessionReady(true);
        return;
      }

      const user = session?.user ?? null;

      setUserId(user?.id ?? null);

      if (user) {
        await checkAdmin(user.id);
      } else {
        setIsAdmin(false);
        setSessionReady(true);
      }
    } catch (error) {
      if (!mounted) return;

      console.error('Gagal menginisialisasi sesi:', error);
      setUserId(null);
      setIsAdmin(false);
      setSessionReady(true);
    }
  };

  void initializeSession();

  const {
    data: { subscription },
  } = client.auth.onAuthStateChange((_event, session) => {
    const user = session?.user ?? null;

    setUserId(user?.id ?? null);

    if (!user) {
      setIsAdmin(false);
      setSessionReady(true);
      return;
    }

    void checkAdmin(user.id);
  });

  return () => {
    mounted = false;
    subscription.unsubscribe();
  };
}, []);
