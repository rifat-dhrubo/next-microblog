/* eslint-disable @typescript-eslint/no-empty-function */
import firebase from 'firebase/app';
import 'firebase/auth';
import { createContext, ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import { useInterval } from 'react-use';
import { useMutation } from 'react-query';
import axios, { AxiosError, AxiosResponse } from 'axios';
import { CreateUserArgs } from '../server/controller/UserController';

const firebaseConfig = {
  apiKey: 'AIzaSyBxOWy44OL_a9ewM11EuB8YTifg4oXkoUw',
  authDomain: 'next-micro-blog.firebaseapp.com',
  projectId: 'next-micro-blog',
  storageBucket: 'next-micro-blog.appspot.com',
  messagingSenderId: '391697363011',
  appId: '1:391697363011:web:d82f95d2d40eff24f7e4f6',
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

type FirebaseContextType = {
  user: firebase.User | null;
  signOut: (forgot?: boolean) => void;
  signInWithEmailAndPassword: (email: string, password: string) => void;
  signUpWithEmailAndPassword: (email: string, password: string) => void;
  authIdToken: string | null;
  authLoading: boolean;
};

const context: FirebaseContextType = {
  user: firebase.auth().currentUser,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  signOut: (forgot?: boolean) => {},
  signInWithEmailAndPassword: () => {},
  signUpWithEmailAndPassword: () => {},
  authIdToken: null,
  authLoading: false,
};

export const AuthContext = createContext(context);

type Props = {
  children: ReactNode;
};

type ResponseType = {
  success: boolean;
  data: {
    _id: string;
    uid: string;
    name: string;
    __v: number;
  };
};

type ErrorType = {
  success: boolean;
};

export const AuthProvider = ({ children }: Props) => {
  const router = useRouter();
  const [authLoading, setAuthLoading] = useState(false);
  const [authIdToken, setAuthIdToken] = useState<null | string>(null);
  const [currentUser, setCurrentUser] = useState(
    () => firebase.auth().currentUser
  );
  const { mutate } = useMutation<
    AxiosResponse<ResponseType>,
    AxiosError<ErrorType>,
    CreateUserArgs
  >((createUser) => axios.post('api/user', createUser), {
    onSuccess: () => {
      toast.success('Welcome');
      router.push('/home');
      setAuthLoading(false);
    },
    onError: () => {
      toast.error('Error! Could not sign in user');
      setAuthLoading(false);
    },
  });

  const signOut = (forgot?: boolean): void => {
    firebase
      .auth()
      .signOut()
      .then(() => {
        if (!forgot) toast.success('Signed out, come back soon 😀');
      })
      .catch((error) => console.error(error));
  };

  const signUpWithEmailAndPassword = async (
    email: string,
    password: string
  ) => {
    setAuthLoading(true);
    try {
      const userCred = await firebase
        .auth()
        .createUserWithEmailAndPassword(email, password);
      if (userCred.user == null) {
        toast.error('User do not exist');
        return;
      }
      setCurrentUser(userCred.user);
      mutate({
        uid: userCred.user.uid,
        name: userCred.user.displayName ?? email,
      });
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        toast.error('User Already exists');
        setAuthLoading(false);
        return;
      }
      toast.error('Error! Could not sign in user');
      setAuthLoading(false);
    }
  };
  const signInWithEmailAndPassword = async (
    email: string,
    password: string
  ) => {
    setAuthLoading(true);
    try {
      const userCred = await firebase
        .auth()
        .signInWithEmailAndPassword(email, password);
      if (userCred.user == null) {
        toast.error('User do not exist');
        return;
      }
      setCurrentUser(userCred.user);
      toast.success('Welcome');
      router.push('/home');
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        toast.error('User do not exist');
        setAuthLoading(false);
        return;
      }
      if (error.code === 'auth/wrong-password') {
        toast.error('Wrong Password');
        setAuthLoading(false);
        return;
      }
      toast.error('Error! Could not sign in user');
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = firebase.auth().onAuthStateChanged(async (userAuth) => {
      try {
        setCurrentUser(userAuth);
      } catch (error) {
        console.log('could not sign in user');
        console.error(error);
        toast.error(
          'Sign-in process failed. Please make sure you are connected to the internet.'
        );
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(function getIdToken() {
    const unsubscribe = firebase.auth().onIdTokenChanged((userInfo) => {
      if (userInfo != null && typeof window !== 'undefined') {
        userInfo
          .getIdToken()
          .then((token) => {
            // eslint-disable-next-line no-mixed-operators
            const fiftyMinFromNow = Date.now() + 1000 * 60 * 50;
            localStorage.setItem('token-timeOut', String(fiftyMinFromNow));
            setAuthIdToken(token);
          })
          .catch((error) => console.error(error))
          .finally(() => {
            setAuthLoading(false);
          });
      }
    });
    return () => unsubscribe();
  });

  useInterval(() => {
    if (typeof window !== 'undefined' && currentUser != null) {
      try {
        const timeOutString = localStorage.getItem('token-timeOut');
        if (timeOutString != null) {
          const timeOutNumber = Number(timeOutString);
          if (Date.now() >= timeOutNumber) {
            currentUser
              .getIdToken(true)
              .then((token) => {
                setAuthIdToken(token);
                // eslint-disable-next-line no-mixed-operators
                const fiftyMinFromNow = Date.now() + 1000 * 60 * 50;
                localStorage.setItem('token-timeOut', String(fiftyMinFromNow));
              })
              .catch((e) => console.error(e));
          }
        }
      } catch (e) {
        console.error(e);
        toast.error('Could not verify user');
        router.push('sign-in');
      }
    }
  }, 1000 * 60 * 3);

  const defaultContext = {
    user: currentUser,
    signOut,
    authLoading,
    authIdToken,
    signInWithEmailAndPassword,
    signUpWithEmailAndPassword,
  };

  return (
    <AuthContext.Provider value={defaultContext}>
      {children}
    </AuthContext.Provider>
  );
};
