"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface AuthContentProps {
  className?: string;
}

export function AuthContent({ className }: AuthContentProps) {
  const router = useRouter();

  return (
    <div className={cn("w-full max-w-sm space-y-6", className)}>
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-medium tracking-tight">PaperTalk</h1>
        <p className="text-sm text-muted-foreground">Sign in to continue</p>
      </div>

      <Tabs defaultValue="signin" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="signin">Sign In</TabsTrigger>
          <TabsTrigger value="login">Log In</TabsTrigger>
        </TabsList>

        <TabsContent value="signin" className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="signin-email">Email</Label>
            <Input id="signin-email" type="email" placeholder="you@example.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signin-password">Password</Label>
            <Input id="signin-password" type="password" placeholder="••••••••" />
          </div>
          <Button className="w-full" variant="outline" disabled>
            Sign In
          </Button>
        </TabsContent>

        <TabsContent value="login" className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="login-email">Email</Label>
            <Input id="login-email" type="email" placeholder="you@example.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="login-password">Password</Label>
            <Input id="login-password" type="password" placeholder="••••••••" />
          </div>
          <Button className="w-full" variant="outline" disabled>
            Log In
          </Button>
        </TabsContent>
      </Tabs>

      <Button className="w-full" onClick={() => router.push("/app")}>
        Continue to Demo
      </Button>
    </div>
  );
}
