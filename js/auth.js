async function login(username,password){
    const res = await fetch("/login", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({username,password})
    });
    return await res.json();
}


async function register(username,password){
    const res = await fetch("/register", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({username,password})
    });
    return await res.json();
}

async function checkLogin(){
    const res = await fetch("/check-login");
    return await res.json();
}

async function logout(){
    await fetch("/logout");
    location.reload();
}
